//! Knowledge collections as a [`ContextSource`]: candidates are cheap
//! (name + description + trigger score, with sizes estimated from file
//! metadata); loading concatenates the overview and documents, truncated to
//! the request's character budget.

use async_trait::async_trait;
use serde_json::json;
use std::fs;
use std::sync::Arc;

use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Error, Result,
};

use crate::collection::KnowledgeCollection;
use crate::library::KnowledgeLibrary;

/// Marker appended when a loaded fragment was cut to fit the budget.
const TRUNCATION_MARKER: &str = "\n(truncated)";

/// Offers every collection visible to the requesting user whose trigger
/// matches the request query.
pub struct KnowledgeContextSource {
    library: Arc<KnowledgeLibrary>,
}

impl KnowledgeContextSource {
    pub fn new(library: Arc<KnowledgeLibrary>) -> Self {
        Self { library }
    }
}

/// Cheap size estimate: overview length plus on-disk document sizes.
fn estimated_chars(collection: &KnowledgeCollection) -> usize {
    let docs: u64 = collection
        .documents
        .iter()
        .filter_map(|doc| fs::metadata(collection.dir.join(doc)).ok())
        .map(|m| m.len())
        .sum();
    collection.overview.len() + usize::try_from(docs).unwrap_or(usize::MAX)
}

/// Truncate `content` to at most `budget` bytes (respecting char
/// boundaries), appending a `(truncated)` marker when content was dropped.
/// A budget of zero means "no budget" and leaves the content untouched.
fn truncate_to_budget(content: String, budget: usize) -> String {
    if budget == 0 || content.len() <= budget {
        return content;
    }
    let mut end = budget.saturating_sub(TRUNCATION_MARKER.len());
    while end > 0 && !content.is_char_boundary(end) {
        end -= 1;
    }
    let mut truncated = content[..end].to_string();
    truncated.push_str(TRUNCATION_MARKER);
    truncated
}

#[async_trait]
impl ContextSource for KnowledgeContextSource {
    fn id(&self) -> &str {
        "knowledge"
    }

    fn kind(&self) -> ContextKind {
        ContextKind::Knowledge
    }

    async fn candidates(&self, req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
        let collections = self.library.discover(req.runtime.user_id())?;
        let mut candidates: Vec<ContextCandidate> = collections
            .into_iter()
            .filter_map(|collection| {
                let score = collection.trigger().score(&req.query);
                (score > 0.0).then(|| ContextCandidate {
                    id: collection.name.clone(),
                    kind: ContextKind::Knowledge,
                    title: collection.name.clone(),
                    description: collection.description.clone(),
                    score,
                    estimated_chars: estimated_chars(&collection),
                })
            })
            .collect();
        candidates.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(candidates)
    }

    async fn load(&self, candidate_id: &str, req: &ContextRequest) -> Result<ContextFragment> {
        let collection = self
            .library
            .find(req.runtime.user_id(), candidate_id)?
            .ok_or_else(|| Error::not_found("knowledge collection", candidate_id))?;

        let content = truncate_to_budget(collection.full_text(), req.char_budget);

        Ok(ContextFragment {
            id: collection.name.clone(),
            kind: ContextKind::Knowledge,
            title: collection.name.clone(),
            content,
            metadata: json!({
                "dir": collection.dir.display().to_string(),
                "documents": collection.documents.len(),
            }),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::KnowledgeRoot;
    use rustra_core::{Principal, RuntimeContext};
    use std::path::Path;

    fn request(user: &str, query: &str, char_budget: usize) -> ContextRequest {
        ContextRequest {
            query: query.into(),
            agent_id: "agent-1".into(),
            thread_id: None,
            runtime: RuntimeContext::new(Principal::user(user)),
            char_budget,
        }
    }

    fn source(tmp: &Path) -> KnowledgeContextSource {
        let root = tmp.join("knowledge");
        let dir = root.join("billing-faq");
        std::fs::create_dir_all(&dir).expect("mkdir");
        std::fs::write(
            dir.join("KNOWLEDGE.md"),
            "---\nname: billing-faq\ndescription: Billing answers\nkeywords: [billing]\n---\n\nBilling overview.\n",
        )
        .expect("write");
        std::fs::write(dir.join("refunds.md"), "Refunds are honored within 30 days.\n")
            .expect("write doc");

        let other = root.join("unrelated-notes");
        std::fs::create_dir_all(&other).expect("mkdir");
        std::fs::write(
            other.join("KNOWLEDGE.md"),
            "---\nname: unrelated-notes\ndescription: Something else\nkeywords: [quantum]\n---\n\nOther overview.\n",
        )
        .expect("write");

        let library = KnowledgeLibrary::new(vec![KnowledgeRoot::shared(root)]);
        KnowledgeContextSource::new(Arc::new(library))
    }

    #[tokio::test]
    async fn candidates_only_include_matches() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let source = source(tmp.path());

        let candidates = source
            .candidates(&request("u1", "question about billing", 4096))
            .await
            .expect("candidates");
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].id, "billing-faq");
        assert_eq!(candidates[0].kind, ContextKind::Knowledge);
        assert!(candidates[0].score > 0.0);
        // Overview + document bytes.
        assert!(candidates[0].estimated_chars > "Billing overview.".len());

        let none = source
            .candidates(&request("u1", "nothing relevant here", 4096))
            .await
            .expect("candidates");
        assert!(none.is_empty());
    }

    #[tokio::test]
    async fn load_concatenates_and_truncates() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let source = source(tmp.path());

        let fragment = source
            .load("billing-faq", &request("u1", "billing", 4096))
            .await
            .expect("load");
        assert!(fragment.content.starts_with("Billing overview."));
        assert!(fragment.content.contains("--- document: refunds.md ---"));
        assert!(fragment.content.contains("30 days"));
        assert!(!fragment.content.contains("(truncated)"));
        assert_eq!(fragment.metadata["documents"], 1);

        // Tight budget truncates with a marker.
        let small = source
            .load("billing-faq", &request("u1", "billing", 40))
            .await
            .expect("load");
        assert!(small.content.len() <= 40);
        assert!(small.content.ends_with("(truncated)"));

        assert!(matches!(
            source.load("missing", &request("u1", "billing", 4096)).await,
            Err(Error::NotFound { .. })
        ));
    }
}
