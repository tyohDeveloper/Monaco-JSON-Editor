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
  - Layout: top toolbar with `Load Sample`, `Paste JSON…`, `Undo`, `Redo`, `Expand All`, `Collapse All`, `Format`, `Copy Path`, `Schema…`; three resizable panes (sizes kept in component state only — no persistence); optional Schema-errors panel between the panes and the status bar (only when a schema is loaded); bottom status bar showing breadcrumb path, type, key/item count, total nodes, byte size, a `Valid` / `Source has errors` indicator, and a `Valid against schema` / `N errors against schema` indicator when a schema is loaded.
  - Entirely client-side and in-memory: no backend, no localStorage, no file upload/download.
  - Tree selection drives BOTH the inspector AND the source pane. The source pane always shows ONLY the selected subtree (sub-label `editing $.user.id` etc.) and Apply writes back at `selectedPath` via `setAtPath` — the rest of the document is left untouched.
  - Switching selection or any external mutation discards any in-flight source draft so the right pane re-syncs to the new subtree.
  - Source parse errors do NOT destroy the document — they surface as a banner + a status-bar indicator and Apply is disabled until the draft is valid.
  - Inspector supports primitive editing, type conversion, key rename for any non-root object key, add child (object key + kind / array append), and delete with confirm.
  - Undo / redo: every doc-changing mutation (paste, load sample, primitive edit, rename, add, delete, source-pane Apply) pushes the prior `{doc, selectedPath}` snapshot onto a `past` stack capped at 100, and clears `future`. Undo restores both the previous document AND the previous selected path, and pushes the current state onto `future`; redo reverses it. Selection-only changes are not pushed. The toolbar shows `Undo` / `Redo` buttons that disable when their stack is empty. A global keyboard handler in `AppShell` binds Ctrl/Cmd+Z to undo and Ctrl/Cmd+Shift+Z (or Ctrl/Cmd+Y) to redo, but only when focus is NOT inside an `INPUT` / `TEXTAREA` / `SELECT` / contentEditable element so the browser's built-in text-field undo still works inside the inspector / source pane.
  - Expand All / Collapse All broadcast tick counters via the store; the tree pane subscribes and calls vanilla-jsoneditor's imperative `expand` / `collapse` methods.
  - Store mutators throw on failure; UI callers wrap in try/catch and push success or error toasts.
  - JSON Schema validation: optional. Schema is loaded via the `Schema…` toolbar button (paste or upload). Validation uses Ajv (`createAjvValidator` from vanilla-jsoneditor) with `ajv-formats` registered so format keywords like `email`, `date`, `uri`, `uuid` work. Validation re-runs whenever doc or schema changes; errors live in `useJsonStore.schemaErrors` and are also passed to vanilla-jsoneditor as a `validator` so they're inline-marked on tree nodes. The Schema-errors panel lists each error (path + message), is collapsible, and clicking a row jumps the selection to that path. The schema can be cleared from either the panel header or the toolbar chip.

## Coding & architecture standards

All code in this repository follows **[`docs/CODING-STANDARDS.md`](docs/CODING-STANDARDS.md)** — the binding rules for layer boundaries, purity, function and file size limits, naming, data externalization, testing, and dependency budgets. Read it before making changes.

Key hard limits: exported function bodies ≤ 20 lines; one export per pure-logic file; pure-core files ≤ 100 lines, other pure/state/controller files ≤ 150, view files ≤ 250 with ≤ 80 lines of markup in the return. §0 of that file maps those layer roles to this repository's actual directories.

The canonical source of truth is the `programming` project knowledge wiki page `concepts/coding-architecture-standards`; the in-repo file is a derived copy. Amend the wiki first, then propagate here.
