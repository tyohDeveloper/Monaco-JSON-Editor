# Adopted Coding Standards

> **Source of truth.** `tyohDeveloper/engineering-standards`, release `1.0.1.1` (tag `standards-1.0.1.1`, commit `9f00458c2f11e8e057dc987b926b4cf1ec4db43e`). If this copy and the tagged release disagree, the release wins. Do not amend this file to propose a standards change; open a proposal in the hub.

Adoption record: [`STANDARDS-ADOPTION.json`](../STANDARDS-ADOPTION.json) (schema 2). Exceptions: [`EXCEPTIONS.md`](EXCEPTIONS.md). Predecessor policy (v2.2 portable edition, superseded; its wiki-authority clause is void under hub ADR-0004): [`standards/portable-v2.2.md`](standards/portable-v2.2.md), retained unchanged for history.

## Retrieval step

The complete applicable policy is the following documents at tag `standards-1.0.1.1`. Agents and reviewers load them from the hub; this repository does not carry a copy.

| Document | Governs here |
|---|---|
| `standards/coding-core.md` | Core rules C-1 to C-49; language classes per the bindings below |
| `standards/bindings/typescript.md` | How each rule is checked in TypeScript; TS-1 to TS-7 |
| `standards/profiles.md` | Delivery profile rules bound to the declared dimensions (§2.1 none, §3.1 packaging) |
| `standards/architecture.md` | Role model |
| `reviews/architecture-review.md`, `reviews/standards-compliance-review.md` | Review procedures |

## Application mapping

JSON explorer. The shipped application is `artifacts/json-explorer`, a static Vite build around `monaco-editor` served as a hosted page with no backend and no storage; the document lives in memory and is lost on reload (`state = none`). Monaco's size rules out single-file packaging (C-21), so packaging stays `hosted-web`. `artifacts/api-server` and `artifacts/mockup-sandbox` are Replit workspace scaffolds with no role in the shipped artifact (E-2).

Delivery profile (declared in the adoption record): `state = none`, `packaging = hosted-web`, `store = none`, `identity = none`, `network = none`, `compute = interactive`; localization scope none. Ports: none. Bindings: `typescript:application`.

Role mapping (responsibility-named directories; roles are not directory names):

| Role | Paths |
|---|---|
| VIEW | `artifacts/json-explorer/src/components/**`, `src/App.tsx`, `src/main.tsx` |
| CONTROLLER | `artifacts/json-explorer/src/hooks/**` |
| STATE | `artifacts/json-explorer/src/store/**` |
| PURE | `artifacts/json-explorer/src/lib/**` |
| PURE-CORE, DATA, MODEL, REMOTE, PLATFORM-* | unmapped |
| excluded | `artifacts/api-server/**`, `artifacts/mockup-sandbox/**` (E-2) |

## Core rule mapping

The predecessor's section numbers appear in older comments and documents. Correspondence to 1.0.1.1 core rules:

| v2.2 section | Core rule |
|---|---|
| §0, §1 roles, import direction, purity | C-1, C-2, C-3, C-4 |
| §1.6, §3.5 single sourcing | C-5 |
| §2 state | C-7, C-8, C-9 |
| §3.1–§3.4 limits | C-11, C-12, C-13 |
| §3.2, §3.8, §3.9 one export, names, barrels | C-6, TS-7 |
| §3.6 dead code | C-20 |
| §3.7, §11 exceptions | C-27 |
| §4 test identifiers | C-18 |
| §5 data | C-14, C-15 |
| §6 indexing | C-16a |
| §7 gating, §7.6 size | C-19, C-21 |
| §8 tests | C-22, C-23 |
| §9 libraries | C-24 |
| §10 license | C-26 |
| §15 localization | C-32–C-44 |
| §17 target | profiles §2, §3 |
| New in 1.0.x without a v2.2 counterpart | C-10, C-30, C-31, CI runner pinning under C-19 |

## Enforcement matrix

Commands are the repository's actual scripts. This repository has no composed build gate and no CI workflow yet (E-1); "manual-review" entries are checked in architecture and compliance reviews until the listed exception closes.

| Core rule | Mechanism | Command | Enforcement |
|---|---|---|---|
| C-19 gating | none; typecheck only | `npm run check` | manual-review (E-1) |
| C-1, C-2 role mapping and import direction | table in this document |  | manual-review |
| C-3 purity of PURE | review |  | manual-review |
| C-6, TS-7 one export, no barrels, no shape names | review |  | manual-review |
| C-11, C-12 function and file limits | review |  | manual-review |
| C-14, C-15 data external | review |  | manual-review |
| C-20 dead code | none |  | manual-review |
| C-24 dependency policy | review of `package.json` |  | manual-review |
| C-26 license inventory | none |  | manual-review |
| C-27 exceptions | `docs/EXCEPTIONS.md` |  | manual-review |
| C-31 no secrets | none; secrets reach code through the environment only |  | manual-review |
| C-22, C-23 tests | none |  | manual-review (E-3) |
| C-24 library budget | `monaco-editor` exceeds the 20 kB gzip cumulative budget by design |  | manual-review (E-4) |

## Extensions

Application-level conventions that are not hub rules and stay here:

- None recorded.

## Exceptions

Open entries with owner and review date: [`EXCEPTIONS.md`](EXCEPTIONS.md).
