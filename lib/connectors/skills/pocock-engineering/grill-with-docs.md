---
name: grill-with-docs
description: Grill + domain-driven design + ubiquitous language. Run the automated grill with documentation as primary evidence source. Build a shared vocabulary between domain experts and engineers. Use when the feature involves complex domain logic or when onboarding to a new domain. Trigger: /grill-with-docs, /domain-grill, /ddd-grill
---

# Grill With Docs

Enhanced grill that grounds the design tree in documentation — especially useful when working in unfamiliar domains or building features that require domain expertise. Combines the grill framework with domain-driven design (DDD) principles and ubiquitous language.

Ported from Matt Pocock's `/grill-with-docs` skill. Essential for the NewLeaf financial domain where regulatory compliance and domain terminology matter.

## Core Philosophy

> "Domain experts and engineers must speak the same language. The grill builds a ubiquitous language — terms that mean exactly one thing to everyone — by anchoring every decision in documented domain knowledge."

## When to Use (instead of /grill)

- **Unfamiliar domain**: You're building in a domain you don't know well
- **Complex terminology**: The feature involves legal, financial, or regulatory terms
- **Multiple stakeholders**: Domain experts, engineers, and product disagree on terms
- **Regulatory context**: Compliance requirements constrain design choices
- **Legacy integration**: Existing systems have undocumented domain rules
- **Onboarding**: New team members need to learn the domain

## The Grill-With-Docs Process

### Phase 1: Document Collection
Gather all domain documentation:
- **Internal docs**: PRDs, ADRs, wiki pages, cortex files
- **External docs**: API documentation, vendor specs, regulatory guidelines
- **Code as doc**: Existing implementations that encode domain rules
- **Domain expert notes**: Slack threads, meeting notes, email discussions

### Phase 2: Ubiquitous Language Extraction
From the documents, extract:
- **Entities**: Nouns that appear consistently (Customer, Payment, Dispute, Enrollment)
- **Actions**: Verbs that describe domain operations (enroll, dispute, chargeback, settle)
- **Rules**: Invariants and constraints (must have valid card, can't dispute settled charge)
- **Events**: Things that happen (payment.succeeded, dispute.filed, enrollment.activated)

### Phase 3: Domain Model Grill
Walk the design tree with domain-modeled questions:
```
1. What domain entities does this feature touch?
2. What are the relationships between these entities?
3. What domain rules constrain this feature?
4. What domain events does this feature produce or consume?
5. What's the ubiquitous language for each concept?
6. Where does this feature sit in the bounded context?
```

### Phase 4: Documentation Gaps
Identify where docs are missing or stale:
- Terms used differently across documents → needs standardization
- Rules implied by code but not documented → needs documentation
- Docs that contradict code → needs resolution or update

## Ubiquitous Language Output

```markdown
# Domain Vocabulary: {Feature Domain}

## Core Entities
- **{Entity Name}**: {definition from docs with citation}
  - Used in: {file paths, doc references}
  - NOT the same as: {similar but distinct concepts}

## Domain Rules
- **{Rule}**: {statement with citation from docs/code}
  - Enforced in: {code location}
  - Exception: {if any}

## Events
- **{Event}**: {what triggers it, what it means}
  - Produced by: {code location}
  - Consumed by: {code location}
```

## Quality Gate

Before proceeding to PRD:
- [ ] Domain vocabulary is extracted and consistent
- [ ] Every domain term used in the feature has a single, unambiguous definition
- [ ] Documentation gaps are identified (but not blocking — can be fixed later)
- [ ] Regulatory/compliance constraints are explicitly listed with citations
- [ ] The design tree respects domain rules found in documentation

## Integration

- **Input**: Feature intent + domain documentation + codebase
- **Output**: Grill output + ubiquitous language vocabulary + doc gap report
- **Next**: `/to-prd` (with domain vocabulary embedded) or update docs first
- **Variant**: Can run as a "domain onboarding" — just the vocabulary extraction

## See Also

- `/grill` — the standard grill (use for features in familiar domains)
- `/to-prd` — PRD incorporates the ubiquitous language
- `jarvis/cortex/research/` — domain research docs (cortex)
- `/improve-codebase-architecture` — if domain rules are scattered across code
