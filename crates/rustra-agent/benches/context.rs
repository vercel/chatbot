//! Micro-benchmarks for the agent's per-turn context assembly: the
//! gather → rank → greedy-pack → load pipeline ([`ContextAssembler::assemble`])
//! and the pure system-prompt rendering ([`AssembledContext::render_system_prompt`]).
//! Sources are in-memory fakes, so this measures the assembler's own CPU cost
//! (ranking across sources, budget packing, fragment loading) with no IO.
//!
//! ```sh
//! cargo bench -p rustra-agent
//! ```

use std::sync::Arc;

use async_trait::async_trait;
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use serde_json::json;
use tokio::runtime::Runtime;

use rustra_agent::{AssembledContext, ContextAssembler};
use rustra_core::{
    ContextCandidate, ContextFragment, ContextKind, ContextRequest, ContextSource, Principal,
    Result, RuntimeContext,
};
use rustra_observability::{ObservabilityHub, RunHandle};

/// An in-memory source advertising `n` candidates with spread-out scores, so
/// ranking and budget packing both do real work.
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
            // ~400 chars of body, the sort of fragment a real source loads.
            content: format!("content of {id}: ").repeat(20),
            metadata: json!({}),
        })
    }
}

/// `sources` sources each advertising `per_source` candidates.
fn sources(sources: usize, per_source: usize) -> Vec<Arc<dyn ContextSource>> {
    (0..sources)
        .map(|s| {
            let candidates = (0..per_source)
                .map(|i| ContextCandidate {
                    id: format!("s{s}-c{i}"),
                    kind: ContextKind::Other,
                    title: format!("candidate {s}.{i}"),
                    description: String::new(),
                    // Scores fan out across [0.1, 1.0) so ranking is non-trivial.
                    score: 0.1 + (i as f32 % 9.0) / 10.0,
                    estimated_chars: 200,
                })
                .collect();
            Arc::new(FakeSource {
                id: format!("src-{s}"),
                candidates,
            }) as Arc<dyn ContextSource>
        })
        .collect()
}

fn request() -> ContextRequest {
    ContextRequest {
        query: "summarise the current state of the project".into(),
        agent_id: "bench".into(),
        thread_id: Some("thread-1".into()),
        runtime: RuntimeContext::new(Principal::user("user-1")),
        char_budget: 24_000,
    }
}

fn bench_assemble(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let req = request();

    let mut group = c.benchmark_group("assemble");
    // (sources, candidates_per_source): a light turn and a heavy one.
    for (n_sources, per) in [(3usize, 8usize), (8, 32)] {
        let srcs = sources(n_sources, per);
        let total = n_sources * per;
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{n_sources}x{per}={total}")),
            &srcs,
            |b, srcs| {
                b.iter(|| {
                    rt.block_on(async {
                        // A fresh noop run per iteration — matches how a turn drives it.
                        let run: RunHandle = ObservabilityHub::noop()
                            .start_run("agent", "bench", "user-1", json!({}))
                            .await;
                        black_box(
                            ContextAssembler::new(12, 0.15)
                                .assemble(black_box(srcs), black_box(&req), &run)
                                .await,
                        )
                    })
                })
            },
        );
    }
    group.finish();
}

fn bench_render_system_prompt(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let instructions = "You are a careful engineering assistant. \
        Prefer existing patterns and keep changes minimal.";

    // Assemble once at each fragment count, then bench the pure rendering
    // repeatedly. Vary the fragment cap so cost scales visibly with how much
    // context got attached.
    let mut group = c.benchmark_group("render_system_prompt");
    for max_fragments in [4usize, 12, 32] {
        let assembled: AssembledContext = rt.block_on(async {
            let run = ObservabilityHub::noop()
                .start_run("agent", "bench", "user-1", json!({}))
                .await;
            ContextAssembler::new(max_fragments, 0.15)
                .assemble(&sources(8, 32), &request(), &run)
                .await
        });
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{}frags", assembled.fragments.len())),
            &assembled,
            |b, assembled| {
                b.iter(|| black_box(assembled.render_system_prompt(black_box(instructions))))
            },
        );
    }
    group.finish();
}

criterion_group!(benches, bench_assemble, bench_render_system_prompt);
criterion_main!(benches);
