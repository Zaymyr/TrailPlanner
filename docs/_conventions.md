# Documentation Conventions

## Frontmatter

Every thematic Markdown file must start with:

```yaml
---
title: <descriptive title>
scope: <architecture | database | business-rule | auth | integration | workflow | design-system | decision>
last_verified: 2026-05-17
ai_priority: <high | medium | low>
related_files:
  - <repo-relative paths>
related_tables:
  - <table names if applicable>
---
```

Root `docs/README.md`, `docs/AGENTS.md`, `docs/_conventions.md`, and README placeholders do not need frontmatter.

## File Names

- Use lowercase kebab-case.
- Use table names in plural where the database table is plural.
- Keep one concept per file.
- Prefer numbered folders for top-level reading order.

## Required Sections

Thematic docs should include:

- Purpose
- Key Concepts
- Main content sections specific to the topic
- Gotchas when applicable
- Related Docs

Workflow docs should include:

- Purpose
- Key Concepts
- Steps
- Validation
- Do Not
- Related Docs

Table docs should include:

- Purpose
- Key Concepts
- Columns
- Foreign Keys
- Indexes
- RLS Policies
- Business Invariants
- Common Queries
- Gotchas
- Related Docs

## Deprecation

To mark a current doc deprecated, add this immediately after frontmatter:

```md
> Deprecated: replaced by `path/to/new-doc.md`. Kept for historical context only.
```

Do not delete old documentation when the historical content may explain past migrations or decisions. Move it under `docs/_archive/` if it is no longer current.

## Conflict and TODO Markers

Use conflict markers when code/migrations disagree with old docs or each other:

```md
<!-- CONFLICT: code says X, old doc said Y. -->
```

Use maintainer-verification TODO markers only when the repo cannot determine the answer:

```md
<!-- TODO: maintainer verification needed for exact live schema for X. -->
```

## Source Rules

- Use repo-relative file paths only.
- Do not invent schema fields, business rules, or integration IDs.
- Do not include secret values.
- Prefer current code and migrations over archived docs.
