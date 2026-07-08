//! Vector search contracts, mirroring Mastra's vector-store interface
//! (`createIndex` / `upsert` / `query`) plus the [`Embedder`] trait Mastra
//! takes from the AI SDK.

use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::RwLock;

use rustra_core::{Error, Result};

/// A similarity search hit.
#[derive(Debug, Clone)]
pub struct VectorHit {
    pub id: String,
    pub score: f32,
    pub metadata: Value,
}

/// Vector index operations. Backends: in-memory (here), SQLite (brute-force
/// over a table), and external stores behind the same trait.
#[async_trait]
pub trait VectorStore: Send + Sync {
    async fn create_index(&self, index: &str, dimension: usize) -> Result<()>;
    /// Insert or replace vectors by id.
    async fn upsert(
        &self,
        index: &str,
        entries: Vec<(String, Vec<f32>, Value)>,
    ) -> Result<()>;
    /// Top-`k` cosine-similarity results.
    async fn query(&self, index: &str, vector: &[f32], top_k: usize) -> Result<Vec<VectorHit>>;
    async fn delete_index(&self, index: &str) -> Result<()>;
}

/// Turns text into vectors. Production backends wrap an embeddings API; the
/// [`MockEmbedder`] gives deterministic vectors for tests and for deployments
/// that have not configured an embedder yet.
#[async_trait]
pub trait Embedder: Send + Sync {
    fn dimension(&self) -> usize;
    async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>>;
}

/// Deterministic hashing embedder (bag-of-character-trigrams). Not
/// semantically meaningful, but stable, fast, dependency-free, and good
/// enough to exercise recall plumbing end-to-end.
pub struct MockEmbedder {
    dimension: usize,
}

impl MockEmbedder {
    pub fn new(dimension: usize) -> Self {
        Self { dimension }
    }
}

impl Default for MockEmbedder {
    fn default() -> Self {
        Self::new(256)
    }
}

#[async_trait]
impl Embedder for MockEmbedder {
    fn dimension(&self) -> usize {
        self.dimension
    }

    async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        Ok(texts
            .iter()
            .map(|text| {
                let mut v = vec![0f32; self.dimension];
                let lowered = text.to_lowercase();
                let bytes = lowered.as_bytes();
                for window in bytes.windows(3) {
                    let mut h: u64 = 1469598103934665603;
                    for b in window {
                        h ^= *b as u64;
                        h = h.wrapping_mul(1099511628211);
                    }
                    v[(h % self.dimension as u64) as usize] += 1.0;
                }
                normalize(&mut v);
                v
            })
            .collect())
    }
}

fn normalize(v: &mut [f32]) {
    let norm = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
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

struct Index {
    dimension: usize,
    entries: HashMap<String, (Vec<f32>, Value)>,
}

/// Reference [`VectorStore`]: exact brute-force cosine search in memory.
#[derive(Default)]
pub struct InMemoryVectorStore {
    indexes: RwLock<HashMap<String, Index>>,
}

impl InMemoryVectorStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl VectorStore for InMemoryVectorStore {
    async fn create_index(&self, index: &str, dimension: usize) -> Result<()> {
        self.indexes
            .write()
            .expect("vector store poisoned")
            .entry(index.to_string())
            .or_insert_with(|| Index { dimension, entries: HashMap::new() });
        Ok(())
    }

    async fn upsert(&self, index: &str, entries: Vec<(String, Vec<f32>, Value)>) -> Result<()> {
        let mut indexes = self.indexes.write().expect("vector store poisoned");
        let idx = indexes
            .get_mut(index)
            .ok_or_else(|| Error::not_found("vector_index", index))?;
        for (id, vector, metadata) in entries {
            if vector.len() != idx.dimension {
                return Err(Error::Validation(format!(
                    "vector dimension {} != index dimension {}",
                    vector.len(),
                    idx.dimension
                )));
            }
            idx.entries.insert(id, (vector, metadata));
        }
        Ok(())
    }

    async fn query(&self, index: &str, vector: &[f32], top_k: usize) -> Result<Vec<VectorHit>> {
        let indexes = self.indexes.read().expect("vector store poisoned");
        let idx = indexes
            .get(index)
            .ok_or_else(|| Error::not_found("vector_index", index))?;
        let mut hits: Vec<VectorHit> = idx
            .entries
            .iter()
            .map(|(id, (v, metadata))| VectorHit {
                id: id.clone(),
                score: cosine(vector, v),
                metadata: metadata.clone(),
            })
            .collect();
        hits.sort_by(|a, b| b.score.total_cmp(&a.score));
        hits.truncate(top_k);
        Ok(hits)
    }

    async fn delete_index(&self, index: &str) -> Result<()> {
        self.indexes.write().expect("vector store poisoned").remove(index);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[tokio::test]
    async fn similar_text_ranks_higher() {
        let store = InMemoryVectorStore::new();
        let embedder = MockEmbedder::default();
        store.create_index("msgs", embedder.dimension()).await.unwrap();

        let texts = vec![
            "the deployment pipeline failed on kubernetes".to_string(),
            "my cat likes tuna and sleeping in the sun".to_string(),
        ];
        let vectors = embedder.embed(&texts).await.unwrap();
        store
            .upsert(
                "msgs",
                vectors
                    .into_iter()
                    .enumerate()
                    .map(|(i, v)| (format!("m{i}"), v, json!({"i": i})))
                    .collect(),
            )
            .await
            .unwrap();

        let q = embedder.embed(&["kubernetes deployment failure".to_string()]).await.unwrap();
        let hits = store.query("msgs", &q[0], 1).await.unwrap();
        assert_eq!(hits[0].id, "m0");
    }
}
