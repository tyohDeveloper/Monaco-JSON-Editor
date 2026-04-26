# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- `artifacts/api-server` (`/api`) — Express API server.
- `artifacts/mockup-sandbox` (`/__mockup`) — design canvas / component preview sandbox.
- `artifacts/json-explorer` (`/`) — **JSON Explorer**: a browser-based, Windows Explorer-style 3-pane JSON viewer/editor.
  - Stack: React + Vite + TypeScript, Zustand store, vanilla-jsoneditor (left tree), Monaco editor (right source), custom React inspector (middle).
  - Layout: top toolbar (Open / Paste / Sample / New / Copy / Download), 3 resizable panes with persisted sizes, bottom status bar (path / type / counts / size / validity).
  - Entirely client-side and in-memory; no backend, no persistence.
  - Edits flow through Zustand: tree selection updates the inspector; inspector mutations (rename key, set value, type conversion, add child, delete) and source pane Apply all update the same store; tree pane is reactively re-rendered.
  - Source parse errors do NOT destroy the document — they are surfaced as a banner + status bar indicator and Apply is disabled until the draft is valid.
  - Source parse-error state is owned by the source pane / status bar and is never silently cleared by tree/inspector mutations.
