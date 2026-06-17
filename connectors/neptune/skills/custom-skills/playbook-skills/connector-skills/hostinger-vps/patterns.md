# hostinger-vps — Patterns

## Common Patterns
- Standard usage follows the functions defined in functions.yaml
- All operations are logged for self-healing analysis
- Health checks precede critical operations

## Success Patterns
- Input validation before function calls
- Idempotent operations where applicable
- Graceful error handling with fallbacks
