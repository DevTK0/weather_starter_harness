# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root
- `docs/adr/` for architecture decisions relevant to the area you're about to work in

If any of these files don't exist, proceed silently.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── apps/
│   ├── event-processor/
│   └── gateway-forwarder/
├── docs/adr/
└── .scratch/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
