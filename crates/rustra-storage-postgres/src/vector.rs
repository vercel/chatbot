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
use crate::Db;

/// Id of the per-index metadata sentinel row.
const SENTINEL_ID: &str = "";

/// Brute-force cosine-similarity vector store on its own Postgres connection
/// (may point at the same database as [`crate::PostgresStorage`] or a
/// separate one).
pub struct PostgresVectorStore {
    db: Db,
}

impl PostgresVectorStore {
    /// Connect to Postgres, spawn the connection driver task, and run any
    /// pending migrations.
    pub async fn connect(conn_str: &str) -> Result<Self> {
        Ok(Self { db: Db::connect(conn_str).await? })
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
            Some(row) => Some(col::<i64>(&row, 0)?.max(0) as usize),
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
        if self.index_dimension(index).await?.is_none() {
            return Err(Error::not_found("vector_index", index));
        }
        let rows = self
            .db
            .query(
                "SELECT id, vector, metadata FROM rustra_vectors \
                 WHERE index_name = $1 AND id <> $2",
                &[&index, &SENTINEL_ID],
            )
            .await?;
        let mut hits = rows
            .iter()
            .map(|row| {
                let id: String = col(row, 0)?;
                let blob: Vec<u8> = col(row, 1)?;
                let metadata: Option<Value> = col(row, 2)?;
                let stored = blob_to_vec(&blob)?;
                Ok(VectorHit {
                    id,
                    score: cosine(vector, &stored),
                    metadata: metadata.unwrap_or(Value::Null),
                })
            })
            .collect::<Result<Vec<_>>>()?;
        hits.sort_by(|a, b| b.score.total_cmp(&a.score));
        hits.truncate(top_k);
        Ok(hits)
    }

    async fn delete_index(&self, index: &str) -> Result<()> {
        self.db
            .execute("DELETE FROM rustra_vectors WHERE index_name = $1", &[&index])
            .await?;
        Ok(())
    }
}
