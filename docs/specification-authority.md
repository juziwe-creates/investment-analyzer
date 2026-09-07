# Specification Authority

## Purpose

This document defines which repository documents are authoritative when product, analytics, UX, architecture, implementation history, and exploratory ideas differ.

## Source-Of-Truth Hierarchy

The documents have the following authority, from highest to lowest:

1. `docs/product-spec.md`
2. `docs/analytics-rules.md`
3. `docs/ui-ux-spec.md`
4. `docs/architecture.md`
5. `docs/roadmap.md`
6. `docs/ideas.md`

Their responsibilities are:

- **Product Spec** defines what Alpha is, its product principles, scope, and user-facing structure.
- **Analytics Rules** define calculation semantics and explicitly identify calculations that still require a decision.
- **UI/UX Spec** defines presentation, interaction, responsive behavior, information hierarchy, and V1/V2 UX scope.
- **Architecture** defines how the software supports the product, analytics, and UX requirements.
- **Roadmap** defines implementation order and preserves delivery history; it does not define product truth.
- **Ideas** contains non-authoritative exploratory material that requires review before promotion into a specification.

## Conflict Rules

When lower-ranking documentation conflicts with higher-ranking documentation, the higher-ranking specification wins.

Existing implementation behavior does not automatically define product requirements. Where implementation and specification differ, the specification is authoritative unless the specification is subsequently amended deliberately.

Implementation details recorded in `docs/analytics-rules.md` remain valuable evidence of current behavior. A behavior marked unresolved there is not an approved product rule merely because it exists in code.

## Change Discipline

- Product changes must update the highest-ranking affected specification first or in the same change.
- Calculation changes must update `docs/analytics-rules.md` in the same change.
- UI changes must remain consistent with `docs/product-spec.md` and `docs/ui-ux-spec.md`.
- Roadmap completion does not amend product requirements.
- Ideas become authoritative only after deliberate review and incorporation into a higher-ranking document.

## Evolution Rule

> Alpha is being evolved, not rebuilt. Preserve working infrastructure, data models, market-data capabilities, authentication, transaction-source-of-truth behavior, and analytics implementations wherever they remain consistent with the authoritative specifications. Refactor or replace only behavior that conflicts with approved requirements or is technically necessary to support them.

> Do not treat visual redesign as justification for rewriting the analytics/data layer.
