//! Micro-benchmarks for the SQLite storage hot paths — the default backend
//! every agent turn and workflow step writes through. Uses an in-memory
//! database so it measures the codec + SQL + `spawn_blocking` cost, not disk.
//!
//! Covered: message append (write) and recent-message read (the memory
//! thread path), plus run insert/update and the paginated `list_runs` read
//! (the observability path).
//!
//! ```sh
//! cargo bench -p rustra-storage-sqlite
//! ```

use chrono::Utc;
use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use serde_json::json;
use tokio::runtime::Runtime;

use rustra_storage::types::{RunRecord, StoredMessage, Thread};
use rustra_storage::{MemoryStore, ObservabilityStore, Page};
use rustra_storage_sqlite::SqliteStorage;

fn message(thread_id: &str, i: usize) -> StoredMessage {
    StoredMessage {
        id: format!("m{i}"),
        thread_id: thread_id.into(),
        resource_id: "user-1".into(),
        role: if i % 2 == 0 { "user" } else { "assistant" }.into(),
        content: json!([{"type": "text", "text": format!("message number {i} with some body")}]),
        created_at: Utc::now(),
    }
}

fn run(i: usize) -> RunRecord {
    RunRecord {
        id: format!("run_{i}"),
        kind: "agent".into(),
        subject_id: "main".into(),
        user_id: "user-1".into(),
        status: "success".into(),
        input: json!({"message": "hello"}),
        output: json!({"text": "hi there"}),
        error: None,
        trace_id: format!("trace_{i}"),
        started_at: Utc::now(),
        ended_at: Some(Utc::now()),
        metadata: json!({}),
    }
}

/// Populate a thread with `n` messages; returns the thread id.
fn seed_thread(rt: &Runtime, store: &SqliteStorage, n: usize) -> String {
    let thread = Thread::new("user-1");
    let id = thread.id.clone();
    rt.block_on(async {
        store.create_thread(thread).await.unwrap();
        for i in 0..n {
            store.append_message(message(&id, i)).await.unwrap();
        }
    });
    id
}

fn bench_message_append(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let store = SqliteStorage::in_memory().unwrap();
    let thread = Thread::new("user-1");
    let thread_id = thread.id.clone();
    rt.block_on(async { store.create_thread(thread).await.unwrap() });

    let mut i = 0usize;
    c.bench_function("append_message", |b| {
        b.iter(|| {
            rt.block_on(async {
                store
                    .append_message(black_box(message(&thread_id, i)))
                    .await
                    .unwrap()
            });
            i += 1;
        })
    });
}

fn bench_recent_messages(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("recent_messages");
    // Read the last 20 from threads of increasing depth: shows whether read
    // cost tracks the returned window or the whole thread.
    for depth in [50usize, 500] {
        let store = SqliteStorage::in_memory().unwrap();
        let thread_id = seed_thread(&rt, &store, depth);
        group.bench_with_input(BenchmarkId::from_parameter(depth), &thread_id, |b, id| {
            b.iter(|| {
                rt.block_on(async { store.recent_messages(black_box(id), 20).await.unwrap() })
            })
        });
    }
    group.finish();
}

fn bench_run_insert_update(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let store = SqliteStorage::in_memory().unwrap();

    let mut i = 0usize;
    c.bench_function("insert_run", |b| {
        b.iter(|| {
            rt.block_on(async { store.insert_run(black_box(run(i))).await.unwrap() });
            i += 1;
        })
    });

    // A run is written twice in its lifetime: insert (running) then update
    // (terminal status). Bench the update against an existing row.
    rt.block_on(async { store.insert_run(run(999_999)).await.unwrap() });
    c.bench_function("update_run", |b| {
        b.iter(|| rt.block_on(async { store.update_run(black_box(run(999_999))).await.unwrap() }))
    });
}

fn bench_list_runs(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let mut group = c.benchmark_group("list_runs");
    for total in [100usize, 1000] {
        let store = SqliteStorage::in_memory().unwrap();
        rt.block_on(async {
            for i in 0..total {
                store.insert_run(run(i)).await.unwrap();
            }
        });
        // First page of 20, filtered by user — the dashboard query.
        group.bench_with_input(BenchmarkId::from_parameter(total), &store, |b, store| {
            b.iter(|| {
                rt.block_on(async {
                    store
                        .list_runs(black_box("user-1"), None, None, Page::first(20))
                        .await
                        .unwrap()
                })
            })
        });
    }
    group.finish();
}

criterion_group!(
    benches,
    bench_message_append,
    bench_recent_messages,
    bench_run_insert_update,
    bench_list_runs
);
criterion_main!(benches);
