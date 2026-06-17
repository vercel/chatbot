# Hyperswitch Anti-Patterns — BANNED

## CRITICAL
- **Mixing NMI and Hyperswitch for same transaction**: Double charge risk.
- **No amount verification**: Wrong amount charged.

## HIGH
- **Infinite payment links**: Unbounded expiry = stale links.
- **Not tracking completed payments**: Payment reconciliation gaps.
