//! Memory processors (Mastra "Memory Processors"): hooks that filter or
//! reshape recalled history before it reaches the model, e.g. to stay inside
//! a context budget or drop tool chatter.

use rustra_storage::types::StoredMessage;

/// Transforms recalled message history. Processors run in registration order.
pub trait MemoryProcessor: Send + Sync {
    fn process(&self, messages: Vec<StoredMessage>) -> Vec<StoredMessage>;
}

/// Keeps the most recent messages that fit within a character budget.
///
/// TECH DEBT: budgeting is by characters, not tokens. Swap in a real
/// tokenizer once one is chosen; the trait boundary will not change.
pub struct CharBudgetProcessor {
    pub max_chars: usize,
}

impl CharBudgetProcessor {
    pub fn new(max_chars: usize) -> Self {
        Self { max_chars }
    }
}

impl MemoryProcessor for CharBudgetProcessor {
    fn process(&self, messages: Vec<StoredMessage>) -> Vec<StoredMessage> {
        let mut total = 0usize;
        let mut kept: Vec<StoredMessage> = messages
            .into_iter()
            .rev() // newest first while accumulating budget
            .take_while(|m| {
                let len = m.content.to_string().len();
                total += len;
                total <= self.max_chars
            })
            .collect();
        kept.reverse(); // back to chronological
        kept
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;

    fn msg(id: &str, text: &str) -> StoredMessage {
        StoredMessage {
            id: id.into(),
            thread_id: "t".into(),
            resource_id: "u".into(),
            role: "user".into(),
            content: json!([{"type": "text", "text": text}]),
            created_at: Utc::now(),
        }
    }

    #[test]
    fn keeps_newest_within_budget() {
        let long = "x".repeat(200);
        let messages = vec![msg("old", &long), msg("mid", "short"), msg("new", "short")];
        let kept = CharBudgetProcessor::new(150).process(messages);
        let ids: Vec<&str> = kept.iter().map(|m| m.id.as_str()).collect();
        assert_eq!(ids, vec!["mid", "new"]);
    }
}
