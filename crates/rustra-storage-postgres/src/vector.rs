//! [`VectorStore`] on Postgres: vectors live in the `rustra_vectors` table as
//! little-endian `f32` `BYTEA` blobs; queries load the index's rows and rank
//! them by cosine similarity in Rust (exact brute-force search, mirroring the
//! SQLite backend).
//!
//! Index metadata (the dimension) is a sentinel row with `id = ''` in the
//! same table, so entry ids must be non-empty.
//!
//! **Tech debt:** pgvector (`vector` column type + ANN indexes with
//! server-side similarity) would be the production choice. This
//! implementation keeps dependencies minimal but loads the entire index into
//! memory on every query.

use async_trait::async_trait;
use rustra_core::{Error, Result};
use rustra_storage::{VectorHit, VectorStore};
use serde_json::Value;

use crate::util::*;
use crate::{Db, PostgresStorage};

/// Id of the per-index metadata sentinel row.
const SENTINEL_ID: &str = "";

/// Brute-force cosine-similarity vector store on its own Postgres connection
/// (may point at the same database as [`crate::PostgresStorage`] — see
/// [`Self::from_storage`] — or a separate one).
#[derive(Clone)]
pub struct PostgresVectorStore {
    db: Db,
}

impl std::fmt::Debug for PostgresVectorStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PostgresVectorStore")
            .finish_non_exhaustive()
    }
}

impl PostgresVectorStore {
    /// Connect to Postgres (e.g. `postgres://user:pass@localhost/rustra`), spawn
    /// the connection driver task, and run any pending migrations.
    pub async fn connect(conn_str: &str) -> Result<Self> {
        Ok(Self {
            db: Db::connect(conn_str).await?,
        })
    }

    /// Share the connection (and already-applied migrations) of an existing
    /// [`PostgresStorage`] pointing at the same database, instead of opening
    /// a second connection.
    pub fn from_storage(storage: &PostgresStorage) -> Self {
        Self {
            db: storage.db.clone(),
        }
    }
}

fn vec_to_blob(v: &[f32]) -> Vec<u8> {
    let mut blob = Vec::with_capacity(v.len() * 4);
    for x in v {
        blob.extend_from_slice(&x.to_le_bytes());
    }
    blob
}

fn blob_to_vec(blob: &[u8]) -> Result<Vec<f32>> {
    if blob.len() % 4 != 0 {
        return Err(Error::Storage(format!(
            "vector blob length {} is not a multiple of 4",
            blob.len()
        )));
    }
    Ok(blob
        .chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect())
}

fn cosine(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b).map(|(x, y)| x * y).sum();
    let na: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let nb: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if na == 0.0 || nb == 0.0 {
        0.0
    } else {
        dot / (na * nb)
    }
}

impl PostgresVectorStore {
    /// Dimension of `index`, or `None` if the index does not exist.
    async fn index_dimension(&self, index: &str) -> Result<Option<usize>> {
        let row = self
            .db
            .query_opt(
                "SELECT dimension FROM rustra_vectors WHERE index_name = $1 AND id = $2",
                &[&index, &SENTINEL_ID],
            )
            .await?;
        Ok(match row {
            Some(row) => {
                let dim: i64 = col(&row, 0)?;
                Some(usize::try_from(dim).map_err(|_| {
                    Error::Storage(format!(
                        "index `{index}` has invalid stored dimension {dim}"
                    ))
                })?)
            }
            None => None,
        })
    }
}

#[async_trait]
impl VectorStore for PostgresVectorStore {
    async fn create_index(&self, index: &str, dimension: usize) -> Result<()> {
        // DO NOTHING: creating an existing index keeps its dimension,
        // matching the in-memory store's `or_insert_with`.
        let dimension = as_i64(dimension);
        self.db
            .execute(
                "INSERT INTO rustra_vectors (index_name, id, dimension, vector, metadata) \
                 VALUES ($1, $2, $3, NULL, NULL) \
                 ON CONFLICT (index_name, id) DO NOTHING",
                &[&index, &SENTINEL_ID, &dimension],
            )
            .await?;
        Ok(())
    }

    async fn upsert(&self, index: &str, entries: Vec<(String, Vec<f32>, Value)>) -> Result<()> {
        let dimension = self
            .index_dimension(index)
            .await?
            .ok_or_else(|| Error::not_found("vector_index", index))?;
        let dim_param = as_i64(dimension);
        for (id, vector, metadata) in &entries {
            if id.is_empty() {
                return Err(Error::Validation("vector id must not be empty".into()));
            }
            if vector.len() != dimension {
                return Err(Error::Validation(format!(
                    "vector dimension {} != index dimension {}",
                    vector.len(),
                    dimension
                )));
            }
            let blob = vec_to_blob(vector);
            self.db
                .execute(
                    "INSERT INTO rustra_vectors (index_name, id, dimension, vector, metadata) \
                     VALUES ($1, $2, $3, $4, $5) \
                     ON CONFLICT (index_name, id) DO UPDATE SET \
                     dimension = EXCLUDED.dimension, vector = EXCLUDED.vector, \
                     metadata = EXCLUDED.metadata",
                    &[&index, &id, &dim_param, &blob, &metadata],
                )
                .await?;
        }
        Ok(())
    }

    async fn query(&self, index: &str, vector: &[f32], top_k: usize) -> Result<Vec<VectorHit>> {
        // One statement fetches the metadata sentinel and the entries in the
        // same snapshot, so index existence and the scanned rows are always
        // judged consistently (no round trip between an exists-check and the
        // scan for a concurrent `delete_index` to slip into).
        let rows = self
            .db
            .query(
                "SELECT id, vector, metadata FROM rustra_vectors WHERE index_name = $1",
                &[&index],
            )
            .await?;
        let mut found = false;
        let mut hits = Vec::with_capacity(rows.len().saturating_sub(1));
        for row in &rows {
            // The sentinel's `vector` column is NULL, so check the id before
            // decoding the blob.
            let id: String = col(row, 0)?;
            if id == SENTINEL_ID {
                found = true;
                continue;
            }
            let blob: Vec<u8> = col(row, 1)?;
            let metadata: Option<Value> = col(row, 2)?;
            let stored = blob_to_vec(&blob)?;
            hits.push(VectorHit {
                id,
                score: cosine(vector, &stored),
                metadata: metadata.unwrap_or(Value::Null),
            });
        }
        if !found {
            return Err(Error::not_found("vector_index", index));
        }
        hits.sort_by(|a, b| b.score.total_cmp(&a.score));
        hits.truncate(top_k);
        Ok(hits)
    }

    async fn delete_index(&self, index: &str) -> Result<()> {
        self.db
            .execute(
                "DELETE FROM rustra_vectors WHERE index_name = $1",
                &[&index],
            )
            .await?;
        Ok(())
    }
}
