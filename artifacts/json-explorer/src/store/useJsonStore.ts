import { create } from "zustand";
import { createAjvValidator, type Validator } from "vanilla-jsoneditor";
import addFormats from "ajv-formats";
import type { FindScope, JsonPath, JsonValue } from "../lib/jsonPath";
import {
  evaluateJsonPath,
  findInDoc,
  getAtPath,
  pathsEqual,
} from "../lib/jsonPath";
import {
  setAtPath,
  deleteAtPath,
  renameKey,
  addChild,
} from "../lib/jsonPatch";
import { SAMPLE_DOC } from "../lib/sampleData";
import { nodeType, isContainer } from "../lib/nodeMeta";

export type ToastKind = "info" | "success" | "error";
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface SchemaError {
  path: JsonPath;
  message: string;
  severity: "warning" | "error" | "info" | string;
}

export interface HistoryEntry {
  doc: JsonValue;
  selectedPath: JsonPath;
}

export const MAX_HISTORY = 100;

export interface JsonState {
  doc: JsonValue;
  selectedPath: JsonPath;
  documentName: string;
  toasts: Toast[];

  // Undo/redo stacks. Each entry captures a snapshot of `doc` and
  // `selectedPath` from before a mutation. Capped at MAX_HISTORY.
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Source pane draft state. `null` means the source pane is in sync with the
  // selected subtree (display from `getAtPath(doc, selectedPath)`).
  // A string means the user has edited the draft locally.
  sourceDraft: string | null;
  // Parse error for the current sourceDraft (null when valid or in sync).
  validationError: string | null;

  // Tick counters that the tree pane watches to imperatively
  // expand/collapse all nodes.
  expandAllTick: number;
  collapseAllTick: number;

  // Find / JSONPath state. The find bar is a single overlay with two inputs:
  // a substring search and a JSONPath expression. Both produce ordered match
  // lists that the user can step through with prev/next.
  findOpen: boolean;
  findQuery: string;
  findCaseSensitive: boolean;
  findScope: FindScope;
  findMatches: JsonPath[];
  findIndex: number; // -1 when there are no matches
  pathQuery: string;
  pathMatches: JsonPath[];
  pathIndex: number;
  pathError: string | null;
  // JSON Schema state
  schema: JsonValue | null;
  schemaName: string | null;
  // Errors derived from validating `doc` against `schema`. Empty when no
  // schema is loaded or the document validates cleanly.
  schemaErrors: SchemaError[];
  // Set when the supplied schema text is not valid JSON, or ajv refuses it.
  schemaLoadError: string | null;
  // Set when running the validator on the current document throws (e.g.
  // an unsupported keyword surfaces only at validate time). Distinct from
  // load errors and from validation errors.
  schemaRuntimeError: string | null;

  // Doc + selection
  setDoc: (next: JsonValue, name?: string) => void;
  setSelectedPath: (path: JsonPath) => void;

  // Inspector mutators (throw on failure; callers wrap and toast)
  applySetValue: (path: JsonPath, value: JsonValue) => void;
  applyRenameKey: (path: JsonPath, newKey: string) => void;
  applyDelete: (path: JsonPath) => void;
  applyAddChild: (
    parentPath: JsonPath,
    key: string | null,
    value: JsonValue,
  ) => void;

  // Source pane (right) actions — operate on the selected subtree
  setSourceDraft: (text: string | null) => void;
  applySourceDraft: () => void;
  formatSourceDraft: () => void;

  // Tree pane controls
  triggerExpandAll: () => void;
  triggerCollapseAll: () => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // Find / JSONPath actions
  openFind: () => void;
  closeFind: () => void;
  setFindQuery: (q: string) => void;
  setFindCaseSensitive: (v: boolean) => void;
  setFindScope: (s: FindScope) => void;
  goToFindMatch: (index: number) => void;
  nextFindMatch: () => void;
  prevFindMatch: () => void;
  setPathQuery: (q: string) => void;
  goToPathMatch: (index: number) => void;
  nextPathMatch: () => void;
  prevPathMatch: () => void;
  // Toolbar utilities
  loadSample: () => void;

  // Schema actions
  loadSchema: (text: string, name?: string) => void;
  clearSchema: () => void;

  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
}

let toastCounter = 0;

// Cache the ajv validator so we don't recompile the schema on every doc edit.
let cachedSchema: JsonValue | null = null;
let cachedValidator: Validator | null = null;

function getValidator(schema: JsonValue | null): Validator | null {
  if (schema === cachedSchema) return cachedValidator;
  cachedSchema = schema;
  if (schema === null) {
    cachedValidator = null;
  } else {
    try {
      cachedValidator = createAjvValidator({
        schema: schema as Parameters<typeof createAjvValidator>[0]["schema"],
        ajvOptions: { allErrors: true, strict: false },
        onCreateAjv: (ajv) => {
          // Register the standard JSON Schema formats (email, date,
          // date-time, uri, uuid, etc.) so schemas using `format` keywords
          // don't fail to compile.
          (addFormats as unknown as (a: unknown) => void)(ajv);
        },
      });
    } catch {
      cachedValidator = null;
    }
  }
  return cachedValidator;
}

export function getSchemaValidator(schema: JsonValue | null): Validator | null {
  return getValidator(schema);
}

function normalizeSegment(seg: string | number): string | number {
  if (typeof seg === "number") return seg;
  if (/^(0|[1-9]\d*)$/.test(seg)) {
    const n = Number(seg);
    if (Number.isFinite(n)) return n;
  }
  return seg;
}

interface ComputedSchemaResult {
  errors: SchemaError[];
  runtimeError: string | null;
}

function computeSchemaErrors(
  doc: JsonValue,
  schema: JsonValue | null,
): ComputedSchemaResult {
  if (schema === null) return { errors: [], runtimeError: null };
  const validator = getValidator(schema);
  if (!validator) {
    return {
      errors: [],
      runtimeError: "Schema validator could not be built",
    };
  }
  let raw: ReturnType<Validator>;
  try {
    raw = validator(doc);
  } catch (e) {
    return { errors: [], runtimeError: (e as Error).message };
  }
  const errors = raw.map((e) => ({
    path: (e.path as readonly (string | number)[]).map(normalizeSegment),
    message: e.message,
    severity: e.severity,
  }));
  return { errors, runtimeError: null };
}

function schemaErrorsEqual(a: SchemaError[], b: SchemaError[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.message !== y.message || x.severity !== y.severity) return false;
    if (!pathsEqual(x.path, y.path)) return false;
  }
  return true;
}

function pushHistory(state: JsonState): {
  past: HistoryEntry[];
  future: HistoryEntry[];
} {
  const entry: HistoryEntry = {
    doc: state.doc,
    selectedPath: state.selectedPath,
  };
  const past =
    state.past.length >= MAX_HISTORY
      ? [...state.past.slice(state.past.length - MAX_HISTORY + 1), entry]
      : [...state.past, entry];
  return { past, future: [] };
}

export const useJsonStore = create<JsonState>((set, get) => ({
  doc: SAMPLE_DOC,
  selectedPath: [],
  documentName: "sample.json",
  toasts: [],

  past: [],
  future: [],

  sourceDraft: null,
  validationError: null,

  expandAllTick: 0,
  collapseAllTick: 0,

  findOpen: false,
  findQuery: "",
  findCaseSensitive: false,
  findScope: "both",
  findMatches: [],
  findIndex: -1,
  pathQuery: "",
  pathMatches: [],
  pathIndex: -1,
  pathError: null,
  schema: null,
  schemaName: null,
  schemaErrors: [],
  schemaLoadError: null,
  schemaRuntimeError: null,

  setDoc: (next, name) =>
    set((s) => ({
      ...pushHistory(s),
      doc: next,
      documentName: name ?? s.documentName,
      // Document changed under us — discard any in-flight source draft so the
      // right pane re-syncs to the new selected subtree.
      sourceDraft: null,
      validationError: null,
    })),

  setSelectedPath: (path) => {
    const cur = get().selectedPath;
    if (pathsEqual(cur, path)) return;
    // Switching selection discards the current source draft (the right pane
    // is now editing a different subtree). Selection changes are NOT pushed
    // onto the undo stack on their own; they ride along with whatever
    // mutation comes next.
    set({ selectedPath: path, sourceDraft: null, validationError: null });
  },

  applySetValue: (path, value) =>
    set((s) => ({
      ...pushHistory(s),
      doc: setAtPath(s.doc, path, value),
      sourceDraft: null,
      validationError: null,
    })),

  applyRenameKey: (path, newKey) =>
    set((s) => {
      const next = renameKey(s.doc, path, newKey);
      const newPath = path.slice(0, -1).concat(newKey);
      return {
        ...pushHistory(s),
        doc: next,
        selectedPath: newPath,
        sourceDraft: null,
        validationError: null,
      };
    }),

  applyDelete: (path) =>
    set((s) => {
      const next = deleteAtPath(s.doc, path);
      const newSel =
        pathsEqual(s.selectedPath, path) || isAncestor(path, s.selectedPath)
          ? path.slice(0, -1)
          : s.selectedPath;
      return {
        ...pushHistory(s),
        doc: next,
        selectedPath: newSel,
        sourceDraft: null,
        validationError: null,
      };
    }),

  applyAddChild: (parentPath, key, value) =>
    set((s) => {
      const next = addChild(s.doc, parentPath, key, value);
      const newPath: JsonPath =
        key !== null
          ? [...parentPath, key]
          : (() => {
              const target = getAtPath(s.doc, parentPath);
              if (Array.isArray(target)) {
                return [...parentPath, target.length];
              }
              return parentPath;
            })();
      return {
        ...pushHistory(s),
        doc: next,
        selectedPath: newPath,
        sourceDraft: null,
        validationError: null,
      };
    }),

  setSourceDraft: (text) => {
    if (text === null) {
      set({ sourceDraft: null, validationError: null });
      return;
    }
    let err: string | null = null;
    try {
      JSON.parse(text);
    } catch (e) {
      err = (e as Error).message;
    }
    set({ sourceDraft: text, validationError: err });
  },

  applySourceDraft: () => {
    const s = get();
    if (s.sourceDraft === null) {
      throw new Error("Nothing to apply");
    }
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(s.sourceDraft) as JsonValue;
    } catch (e) {
      const msg = (e as Error).message;
      set({ validationError: msg });
      throw new Error(msg);
    }
    const next = setAtPath(s.doc, s.selectedPath, parsed);
    set({
      ...pushHistory(s),
      doc: next,
      sourceDraft: null,
      validationError: null,
    });
  },

  formatSourceDraft: () => {
    const { sourceDraft, selectedPath, doc } = get();
    const text =
      sourceDraft !== null
        ? sourceDraft
        : safeStringify(getAtPath(doc, selectedPath));
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(text) as JsonValue;
    } catch (e) {
      const msg = (e as Error).message;
      set({ validationError: msg });
      throw new Error(msg);
    }
    const formatted = JSON.stringify(parsed, null, 2);
    const inSyncFormatted = safeStringify(getAtPath(doc, selectedPath));
    if (formatted === inSyncFormatted) {
      set({ sourceDraft: null, validationError: null });
    } else {
      set({ sourceDraft: formatted, validationError: null });
    }
  },

  triggerExpandAll: () => set((s) => ({ expandAllTick: s.expandAllTick + 1 })),
  triggerCollapseAll: () =>
    set((s) => ({ collapseAllTick: s.collapseAllTick + 1 })),

  undo: () => {
    const s = get();
    if (s.past.length === 0) return;
    const prev = s.past[s.past.length - 1]!;
    const future = [
      ...s.future,
      { doc: s.doc, selectedPath: s.selectedPath },
    ];
    const cappedFuture =
      future.length > MAX_HISTORY
        ? future.slice(future.length - MAX_HISTORY)
        : future;
    set({
      doc: prev.doc,
      selectedPath: prev.selectedPath,
      past: s.past.slice(0, -1),
      future: cappedFuture,
      sourceDraft: null,
      validationError: null,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[s.future.length - 1]!;
    const past = [
      ...s.past,
      { doc: s.doc, selectedPath: s.selectedPath },
    ];
    const cappedPast =
      past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past;
    set({
      doc: next.doc,
      selectedPath: next.selectedPath,
      past: cappedPast,
      future: s.future.slice(0, -1),
      sourceDraft: null,
      validationError: null,
    });
  },

  openFind: () => set({ findOpen: true }),
  closeFind: () => set({ findOpen: false }),

  setFindQuery: (q) => {
    const s = get();
    const matches = findInDoc(s.doc, q, {
      caseSensitive: s.findCaseSensitive,
      scope: s.findScope,
    });
    const newIndex = matches.length === 0 ? -1 : 0;
    set({ findQuery: q, findMatches: matches, findIndex: newIndex });
    if (newIndex >= 0) {
      set({ selectedPath: matches[newIndex]!, sourceDraft: null, validationError: null });
    }
  },

  setFindCaseSensitive: (v) => {
    const s = get();
    const matches = findInDoc(s.doc, s.findQuery, {
      caseSensitive: v,
      scope: s.findScope,
    });
    const newIndex = matches.length === 0 ? -1 : 0;
    set({ findCaseSensitive: v, findMatches: matches, findIndex: newIndex });
    if (newIndex >= 0) {
      set({ selectedPath: matches[newIndex]!, sourceDraft: null, validationError: null });
    }
  },

  setFindScope: (scope) => {
    const s = get();
    const matches = findInDoc(s.doc, s.findQuery, {
      caseSensitive: s.findCaseSensitive,
      scope,
    });
    const newIndex = matches.length === 0 ? -1 : 0;
    set({ findScope: scope, findMatches: matches, findIndex: newIndex });
    if (newIndex >= 0) {
      set({ selectedPath: matches[newIndex]!, sourceDraft: null, validationError: null });
    }
  },

  goToFindMatch: (index) => {
    const s = get();
    if (s.findMatches.length === 0) return;
    const wrapped =
      ((index % s.findMatches.length) + s.findMatches.length) %
      s.findMatches.length;
    set({
      findIndex: wrapped,
      selectedPath: s.findMatches[wrapped]!,
      sourceDraft: null,
      validationError: null,
    });
  },

  nextFindMatch: () => {
    const s = get();
    if (s.findMatches.length === 0) return;
    s.goToFindMatch(s.findIndex < 0 ? 0 : s.findIndex + 1);
  },

  prevFindMatch: () => {
    const s = get();
    if (s.findMatches.length === 0) return;
    s.goToFindMatch(s.findIndex < 0 ? s.findMatches.length - 1 : s.findIndex - 1);
  },

  setPathQuery: (q) => {
    const s = get();
    const trimmed = q.trim();
    if (trimmed.length === 0) {
      set({
        pathQuery: q,
        pathMatches: [],
        pathIndex: -1,
        pathError: null,
      });
      return;
    }
    let matches: JsonPath[] = [];
    let err: string | null = null;
    try {
      matches = evaluateJsonPath(s.doc, trimmed);
    } catch (e) {
      err = (e as Error).message;
    }
    const newIndex = matches.length === 0 ? -1 : 0;
    set({
      pathQuery: q,
      pathMatches: matches,
      pathIndex: newIndex,
      pathError: err,
    });
    if (newIndex >= 0) {
      set({
        selectedPath: matches[newIndex]!,
        sourceDraft: null,
        validationError: null,
      });
    }
  },

  goToPathMatch: (index) => {
    const s = get();
    if (s.pathMatches.length === 0) return;
    const wrapped =
      ((index % s.pathMatches.length) + s.pathMatches.length) %
      s.pathMatches.length;
    set({
      pathIndex: wrapped,
      selectedPath: s.pathMatches[wrapped]!,
      sourceDraft: null,
      validationError: null,
    });
  },

  nextPathMatch: () => {
    const s = get();
    if (s.pathMatches.length === 0) return;
    s.goToPathMatch(s.pathIndex < 0 ? 0 : s.pathIndex + 1);
  },

  prevPathMatch: () => {
    const s = get();
    if (s.pathMatches.length === 0) return;
    s.goToPathMatch(s.pathIndex < 0 ? s.pathMatches.length - 1 : s.pathIndex - 1);
  },
  loadSample: () =>
    set((s) => ({
      ...pushHistory(s),
      doc: SAMPLE_DOC,
      selectedPath: [],
      documentName: "sample.json",
      sourceDraft: null,
      validationError: null,
    })),

  loadSchema: (text, name) => {
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(text) as JsonValue;
    } catch (e) {
      const msg = (e as Error).message;
      set({ schemaLoadError: `Invalid JSON: ${msg}` });
      throw new Error(`Invalid JSON: ${msg}`);
    }
    if (parsed === null || typeof parsed !== "object") {
      const msg = "Schema must be a JSON object";
      set({ schemaLoadError: msg });
      throw new Error(msg);
    }
    // Try to compile up-front so we can surface ajv errors here instead of
    // failing later inside the editor.
    try {
      cachedSchema = null;
      cachedValidator = null;
      const v = getValidator(parsed);
      if (!v) throw new Error("Could not build validator from schema");
      v(get().doc);
    } catch (e) {
      cachedSchema = null;
      cachedValidator = null;
      const msg = (e as Error).message;
      set({ schemaLoadError: `Invalid schema: ${msg}` });
      throw new Error(`Invalid schema: ${msg}`);
    }
    set({
      schema: parsed,
      schemaName: name ?? "schema.json",
      schemaLoadError: null,
    });
  },

  clearSchema: () =>
    set({
      schema: null,
      schemaName: null,
      schemaErrors: [],
      schemaLoadError: null,
      schemaRuntimeError: null,
    }),

  pushToast: (kind, message) => {
    const id = ++toastCounter;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 1700);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Recompute schema errors whenever the doc or schema changes.
useJsonStore.subscribe((state, prev) => {
  if (state.doc === prev.doc && state.schema === prev.schema) return;
  const { errors, runtimeError } = computeSchemaErrors(state.doc, state.schema);
  const errorsChanged = !schemaErrorsEqual(errors, state.schemaErrors);
  const runtimeChanged = runtimeError !== state.schemaRuntimeError;
  if (!errorsChanged && !runtimeChanged) return;
  useJsonStore.setState({
    schemaErrors: errors,
    schemaRuntimeError: runtimeError,
  });
});

// Recompute find / JSONPath matches when the document changes (e.g. after an
// edit or undo). The match list is order-stable so we try to keep the user
// pinned to the same path; if it's gone we clamp to the nearest valid index.
useJsonStore.subscribe((state, prev) => {
  if (state.doc === prev.doc) return;
  const updates: Partial<JsonState> = {};

  if (state.findQuery.length > 0) {
    const previousActive =
      state.findIndex >= 0 ? state.findMatches[state.findIndex] ?? null : null;
    const matches = findInDoc(state.doc, state.findQuery, {
      caseSensitive: state.findCaseSensitive,
      scope: state.findScope,
    });
    let newIndex = matches.length === 0 ? -1 : 0;
    if (previousActive !== null) {
      const idx = matches.findIndex((p) => pathsEqual(p, previousActive));
      if (idx >= 0) newIndex = idx;
      else if (matches.length > 0) {
        newIndex = Math.min(state.findIndex, matches.length - 1);
        if (newIndex < 0) newIndex = 0;
      }
    }
    updates.findMatches = matches;
    updates.findIndex = newIndex;
  }

  if (state.pathQuery.trim().length > 0) {
    const previousActive =
      state.pathIndex >= 0 ? state.pathMatches[state.pathIndex] ?? null : null;
    let matches: JsonPath[] = [];
    let err: string | null = null;
    try {
      matches = evaluateJsonPath(state.doc, state.pathQuery.trim());
    } catch (e) {
      err = (e as Error).message;
    }
    let newIndex = matches.length === 0 ? -1 : 0;
    if (previousActive !== null && matches.length > 0) {
      const idx = matches.findIndex((p) => pathsEqual(p, previousActive));
      if (idx >= 0) newIndex = idx;
      else newIndex = Math.min(Math.max(state.pathIndex, 0), matches.length - 1);
    }
    updates.pathMatches = matches;
    updates.pathIndex = newIndex;
    updates.pathError = err;
  }

  if (Object.keys(updates).length > 0) {
    useJsonStore.setState(updates);
  }
});
function isAncestor(ancestor: JsonPath, descendant: JsonPath): boolean {
  if (ancestor.length >= descendant.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) return false;
  }
  return true;
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function selectedTypeOf(state: JsonState) {
  const value = getAtPath(state.doc, state.selectedPath);
  return {
    value,
    type: nodeType(value),
    isContainer: isContainer(nodeType(value)),
  };
}
