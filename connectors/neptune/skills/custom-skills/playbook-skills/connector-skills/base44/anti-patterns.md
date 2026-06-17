# Base44 Anti-Patterns — BANNED

## CRITICAL
- **Query without count first on large datasets**: Memory blowup.
- **Using wrong entity names**: Must check schema_list_entities first.
- **Raw SQL without jarvisDataGuard**: Use validated_query or reporting_hub.
- **Updating without reading first**: Always get, verify, then patch.

## HIGH
- **Fetching all 25K records into memory**: Use b44_stream for > 1000.
- **Individual entity reads for customer 360**: Use b44_customer_360 instead.
- **Missing error handling on creates**: Silent data loss.

## MEDIUM
- **Bypassing aggregation for counts**: b44_aggregate is server-side, faster.
- **Not closing DB connections**: Pool management matters.
