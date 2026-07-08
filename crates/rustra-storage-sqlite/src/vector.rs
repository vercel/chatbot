//! [`VectorStore`] on SQLite: vectors live in the `rustra_vectors` table as
//! little-endian `f32` BLOBs; queries load the index's rows and rank them by
//! cosine similarity in Rust (exact brute-force search, like Mastra's
//! LibSQL vector default).
//!
//! Index metadata (the dimension) is a sentinel row with `id = ''` in the
//! same table, so entry ids must be non-empty.

use std::path::Path;

use async_trait::async_trait;
use rusqlite::params;
use rustra_core::{Error, Result};
use rustra_storage::{VectorHit, VectorStore};
use serde_json::Value;

use crate::util::*;
use crate::Db;

/// Id of the per-index metadata sentinel row.
const SENTINEL_ID: &str = "";

/// Brute-force cosine-similarity vector store on its own SQLite connection
/// (may point at the same file as [`crate::SqliteStorage`] or a separate one).
/// Cloning is cheap and yields another handle to the same database connection.
#[derive(Clone, Debug)]
pub struct SqliteVectorStore {
    db: Db,
}

impl SqliteVectorStore {
    /// Open (creating if necessary) the database file at `path`.
    ///
    /// Runs the same schema migrations as [`crate::SqliteStorage`], so the
    /// file carries the full `rustra_` schema and may be (or become) a
    /// storage database — only the `rustra_vectors` table is used by this
    /// store.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        Ok(Self {
            db: Db::open(path.as_ref())?,
        })
    }

    /// A private in-memory vector store — hermetic, gone on drop.
    /// The full schema is provisioned, but only `rustra_vectors` is used.
    pub fn in_memory() -> Result<Self> {
        Ok(Self {
            db: Db::open_in_memory()?,
        })
    }

    /// A vector store over an existing shared database handle.
    pub(crate) fn from_db(db: Db) -> Self {
        Self { db }
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

/// Dimension of `index`, or `None` if the index does not exist.
fn index_dimension(conn: &rusqlite::Connection, index: &str) -> Result<Option<usize>> {
    let dim = query_opt(
        conn,
        "SELECT dimension FROM rustra_vectors WHERE index_name = ?1 AND id = ?2",
        params![index, SENTINEL_ID],
        |row| col::<i64, _>(row, 0),
    )?;
    Ok(dim.map(|d| d.max(0) as usize))
}

#[async_trait]
impl VectorStore for SqliteVectorStore {
    async fn create_index(&self, index: &str, dimension: usize) -> Result<()> {
        let index = index.to_owned();
        self.db
            .call(move |conn| {
                // OR IGNORE: creating an existing index keeps its dimension,
                // matching the in-memory store's `or_insert_with`.
                exec(
                    conn,
                    "INSERT OR IGNORE INTO rustra_vectors \
                     (index_name, id, dimension, vector, metadata) \
                     VALUES (?1, ?2, ?3, NULL, NULL)",
                    params![index, SENTINEL_ID, as_i64(dimension)],
                )?;
                Ok(())
            })
            .await
    }

    async fn upsert(&self, index: &str, entries: Vec<(String, Vec<f32>, Value)>) -> Result<()> {
        let index = index.to_owned();
        self.db
            .call(move |conn| {
                with_tx(conn, |tx| {
                    let dimension = index_dimension(tx, &index)?
                        .ok_or_else(|| Error::not_found("vector_index", &index))?;
                    let mut stmt = tx
                        .prepare(
                            "INSERT OR REPLACE INTO rustra_vectors \
                             (index_name, id, dimension, vector, metadata) \
                             VALUES (?1, ?2, ?3, ?4, ?5)",
                        )
                        .map_err(storage_err)?;
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
                        stmt.execute(params![
                            index,
                            id,
                            as_i64(dimension),
                            vec_to_blob(vector),
                            json_to_sql(metadata)?,
                        ])
                        .map_err(storage_err)?;
                    }
                    Ok(())
                })
            })
            .await
    }

    async fn query(&self, index: &str, vector: &[f32], top_k: usize) -> Result<Vec<VectorHit>> {
        let index = index.to_owned();
        let query = vector.to_vec();
        self.db
            .call(move |conn| {
                if index_dimension(conn, &index)?.is_none() {
                    return Err(Error::not_found("vector_index", &index));
                }
                let mut hits = query_all(
                    conn,
                    "SELECT id, vector, metadata FROM rustra_vectors \
                     WHERE index_name = ?1 AND id <> ?2",
                    params![index, SENTINEL_ID],
                    |row| {
                        let id: String = col(row, "id")?;
                        let blob: Vec<u8> = col(row, "vector")?;
                        let metadata = col_json(row, "metadata")?;
                        let stored = blob_to_vec(&blob)?;
                        Ok(VectorHit {
                            id,
                            score: cosine(&query, &stored),
                            metadata,
                        })
                    },
                )?;
                hits.sort_by(|a, b| b.score.total_cmp(&a.score));
                hits.truncate(top_k);
                Ok(hits)
            })
            .await
    }

    async fn delete_index(&self, index: &str) -> Result<()> {
        let index = index.to_owned();
        self.db
            .call(move |conn| {
                exec(
                    conn,
                    "DELETE FROM rustra_vectors WHERE index_name = ?1",
                    params![index],
                )?;
                Ok(())
            })
            .await
    }
}
