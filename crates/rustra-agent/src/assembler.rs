//! The dynamic context assembler.
//!
//! One mental model for all context (the progressive-disclosure pattern from
//! Agent Skills, applied uniformly): every [`ContextSource`] cheaply
//! advertises candidates; the assembler ranks them across sources, packs
//! greedily within the character budget, loads the winners, and records the
//! whole attachment as a trace span.

use serde_json::json;
use std::fmt::Write as _;
use std::sync::Arc;

use rustra_core::{ContextCandidate, ContextFragment, ContextRequest, ContextSource};
use rustra_observability::{span_kind, RunHandle};

/// The fragments chosen for one turn.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct AssembledContext {
    /// The selected fragments, highest score first.
    pub fragments: Vec<ContextFragment>,
}

impl AssembledContext {
    /// Render the final system prompt: agent instructions followed by each
    /// fragment in a titled section.
    pub fn render_system_prompt(&self, instructions: &str) -> String {
        let mut prompt = instructions.trim().to_string();
        if self.fragments.is_empty() {
            return prompt;
        }
        prompt.push_str("\n\n# Attached context\n");
        prompt.push_str(
            "The following context was attached because it is relevant to the current request.\n",
        );
        for fragment in &self.fragments {
            // fmt::Write to a String is infallible.
            let _ = write!(
                prompt,
                "\n## {} ({})\n{}\n",
                fragment.title,
                fragment.kind.as_str(),
                fragment.content.trim()
            );
        }
        prompt
    }
}

/// Ranks and loads context candidates. See module docs.
#[derive(Debug, Clone, PartialEq)]
pub struct ContextAssembler {
    max_fragments: usize,
    min_score: f32,
}

/// How many ranked candidates the packer considers, as a multiple of
/// `max_fragments` — bounds total `load` attempts when candidates are over
/// budget or fail to load.
const CANDIDATE_OVERSCAN: usize = 2;

impl ContextAssembler {
    /// An assembler that attaches at most `max_fragments` fragments, each
    /// with score >= `min_score`.
    pub fn new(max_fragments: usize, min_score: f32) -> Self {
        Self {
            max_fragments,
            min_score,
        }
    }

    /// Run the pipeline for one turn: gather candidates from every source,
    /// rank them, pack greedily within `request.char_budget`, load the
    /// winners, and record the attachment as a trace span. Source failures
    /// are logged and skipped, never fatal.
    pub async fn assemble(
        &self,
        sources: &[Arc<dyn ContextSource>],
        request: &ContextRequest,
        run: &RunHandle,
    ) -> AssembledContext {
        if sources.is_empty() {
            return AssembledContext::default();
        }
        let span = run
            .span(
                "context assembly",
                span_kind::CONTEXT_ATTACH,
                json!({ "sources": sources.len(), "budget": request.char_budget }),
            )
            .await;

        // 1. Gather candidates from every source. A failing source is logged
        //    and skipped — context attachment must never take down a run.
        let mut ranked: Vec<(usize, ContextCandidate)> = Vec::new();
        for (index, source) in sources.iter().enumerate() {
            match source.candidates(request).await {
                Ok(candidates) => {
                    ranked.extend(candidates.into_iter().map(|c| (index, c)));
                }
                Err(e) => {
                    tracing::warn!(source = source.id(), error = %e, "context source failed");
                }
            }
        }

        // 2. Rank by score, then pack greedily within the budget.
        ranked.retain(|(_, c)| c.score >= self.min_score);
        ranked.sort_by(|a, b| b.1.score.total_cmp(&a.1.score));

        let mut fragments = Vec::new();
        let mut attached_meta = Vec::new();
        let mut remaining = request.char_budget;
        for (source_index, candidate) in ranked
            .into_iter()
            .take(self.max_fragments * CANDIDATE_OVERSCAN)
        {
            if fragments.len() >= self.max_fragments {
                break;
            }
            if candidate.estimated_chars > remaining {
                continue;
            }
            let source = &sources[source_index];
            match source.load(&candidate.id, request).await {
                Ok(mut fragment) => {
                    // Enforce the budget on actual content, not the estimate.
                    if fragment.content.len() > remaining {
                        fragment.content = truncate_to_bytes(&fragment.content, remaining);
                    }
                    remaining = remaining.saturating_sub(fragment.content.len());
                    attached_meta.push(json!({
                        "source": source.id(),
                        "id": fragment.id,
                        "kind": fragment.kind,
                        "score": candidate.score,
                        "chars": fragment.content.len(),
                    }));
                    fragments.push(fragment);
                }
                Err(e) => {
                    tracing::warn!(
                        source = source.id(),
                        candidate = candidate.id,
                        error = %e,
                        "context load failed"
                    );
                }
            }
        }

        span.end_ok(json!({ "attached": attached_meta })).await;
        AssembledContext { fragments }
    }
}

const TRUNCATION_SUFFIX: &str = "\n…(truncated)";

/// Truncate so the result is at most `max_bytes` bytes, cutting on a char
/// boundary and appending a marker when it fits.
fn truncate_to_bytes(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        return s.to_string();
    }
    // Reserve room for the marker only when it fits within the budget.
    let suffix = if max_bytes >= TRUNCATION_SUFFIX.len() {
        TRUNCATION_SUFFIX
    } else {
        ""
    };
    let mut end = max_bytes - suffix.len();
    while end > 0 && !s.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}{suffix}", &s[..end])
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use rustra_core::{ContextKind, Principal, Result, RuntimeContext};
    use rustra_observability::ObservabilityHub;

    struct FakeSource {
        id: String,
        candidates: Vec<ContextCandidate>,
    }

    #[async_trait]
    impl ContextSource for FakeSource {
        fn id(&self) -> &str {
            &self.id
        }
        fn kind(&self) -> ContextKind {
            ContextKind::Other
        }
        async fn candidates(&self, _req: &ContextRequest) -> Result<Vec<ContextCandidate>> {
            Ok(self.candidates.clone())
        }
        async fn load(&self, id: &str, _req: &ContextRequest) -> Result<ContextFragment> {
            Ok(ContextFragment {
                id: id.to_string(),
                kind: ContextKind::Other,
                title: id.to_string(),
                content: format!("content of {id}"),
                metadata: json!({}),
            })
        }
    }

    fn candidate(id: &str, score: f32, chars: usize) -> ContextCandidate {
        ContextCandidate {
            id: id.into(),
            kind: ContextKind::Other,
            title: id.into(),
            description: String::new(),
            score,
            estimated_chars: chars,
        }
    }

    #[tokio::test]
    async fn ranks_across_sources_and_respects_budget() {
        let sources: Vec<Arc<dyn ContextSource>> = vec![
            Arc::new(FakeSource {
                id: "a".into(),
                candidates: vec![candidate("low", 0.2, 50), candidate("high", 0.9, 50)],
            }),
            Arc::new(FakeSource {
                id: "b".into(),
                candidates: vec![
                    candidate("mid", 0.5, 50),
                    candidate("too-big", 0.8, 10_000),
                    candidate("below-threshold", 0.05, 10),
                ],
            }),
        ];
        let request = ContextRequest {
            query: "q".into(),
            agent_id: "agent".into(),
            thread_id: None,
            runtime: RuntimeContext::new(Principal::user("u")),
            char_budget: 100,
        };
        let run = ObservabilityHub::noop()
            .start_run("agent", "a", "u", json!({}))
            .await;
        let assembled = ContextAssembler::new(10, 0.15)
            .assemble(&sources, &request, &run)
            .await;

        let ids: Vec<&str> = assembled.fragments.iter().map(|f| f.id.as_str()).collect();
        // Ranked by score across sources; "too-big" skipped (over budget),
        // "below-threshold" filtered by min score. Actual loaded content is
        // small, so the rest fit the budget.
        assert_eq!(ids, vec!["high", "mid", "low"]);

        let prompt = assembled.render_system_prompt("Base instructions.");
        assert!(prompt.starts_with("Base instructions."));
        assert!(prompt.contains("content of high"));
    }

    #[test]
    fn truncate_to_bytes_never_exceeds_budget() {
        let s = "x".repeat(100);
        for max in [0usize, 5, 20, 50, 99] {
            let out = truncate_to_bytes(&s, max);
            assert!(out.len() <= max, "max = {max}, got {} bytes", out.len());
        }
    }

    #[test]
    fn truncate_to_bytes_cuts_multibyte_input_on_char_boundaries() {
        let s = "日本語".repeat(20);
        for max in 0..=s.len() {
            let out = truncate_to_bytes(&s, max);
            assert!(out.len() <= max, "max = {max}, got {} bytes", out.len());
        }
    }

    #[test]
    fn truncate_to_bytes_returns_input_unchanged_when_it_fits() {
        let s = "fits exactly";
        assert_eq!(truncate_to_bytes(s, s.len()), s);
    }
}
