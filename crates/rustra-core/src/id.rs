/// Generate a prefixed, globally unique identifier, e.g. `run_5f0c…`.
///
/// Prefixes make ids self-describing in logs and traces. Conventional
/// prefixes used across the framework:
/// `usr`, `agt`, `thr`, `msg`, `run`, `trc`, `spn`, `tsk`, `sch`, `sig`,
/// `wf`, `wfr` (workflow run), `skl`, `kn`, `ws`, `mcp`, `ui`, `def`, `grant`.
pub fn new_id(prefix: &str) -> String {
    format!("{prefix}_{}", uuid::Uuid::new_v4().simple())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_prefixed_and_unique() {
        let a = new_id("run");
        let b = new_id("run");
        assert!(a.starts_with("run_"));
        assert_ne!(a, b);
    }
}
