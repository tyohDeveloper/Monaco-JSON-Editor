import { create } from "zustand";
import { createAjvValidator, type Validator } from "vanilla-jsoneditor";
import addFormats from "ajv-formats";
import type { JsonPath, JsonValue } from "../lib/jsonPath";
import { getAtPath, pathsEqual } from "../lib/jsonPath";
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

export interface JsonState {
  doc: JsonValue;
  selectedPath: JsonPath;
  documentName: string;
  toasts: Toast[];

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

export const useJsonStore = create<JsonState>((set, get) => ({
  doc: SAMPLE_DOC,
  selectedPath: [],
  documentName: "sample.json",
  toasts: [],

  sourceDraft: null,
  validationError: null,

  expandAllTick: 0,
  collapseAllTick: 0,

  schema: null,
  schemaName: null,
  schemaErrors: [],
  schemaLoadError: null,
  schemaRuntimeError: null,

  setDoc: (next, name) =>
    set((s) => ({
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
    // is now editing a different subtree).
    set({ selectedPath: path, sourceDraft: null, validationError: null });
  },

  applySetValue: (path, value) => {
    const next = setAtPath(get().doc, path, value);
    set({ doc: next, sourceDraft: null, validationError: null });
  },

  applyRenameKey: (path, newKey) => {
    const next = renameKey(get().doc, path, newKey);
    const newPath = path.slice(0, -1).concat(newKey);
    set({
      doc: next,
      selectedPath: newPath,
      sourceDraft: null,
      validationError: null,
    });
  },

  applyDelete: (path) => {
    const next = deleteAtPath(get().doc, path);
    const sel = get().selectedPath;
    const newSel =
      pathsEqual(sel, path) || isAncestor(path, sel)
        ? path.slice(0, -1)
        : sel;
    set({
      doc: next,
      selectedPath: newSel,
      sourceDraft: null,
      validationError: null,
    });
  },

  applyAddChild: (parentPath, key, value) => {
    const next = addChild(get().doc, parentPath, key, value);
    const newPath: JsonPath =
      key !== null
        ? [...parentPath, key]
        : (() => {
            const target = getAtPath(get().doc, parentPath);
            if (Array.isArray(target)) {
              return [...parentPath, target.length];
            }
            return parentPath;
          })();
    set({
      doc: next,
      selectedPath: newPath,
      sourceDraft: null,
      validationError: null,
    });
  },

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
    const { sourceDraft, selectedPath, doc } = get();
    if (sourceDraft === null) {
      throw new Error("Nothing to apply");
    }
    let parsed: JsonValue;
    try {
      parsed = JSON.parse(sourceDraft) as JsonValue;
    } catch (e) {
      const msg = (e as Error).message;
      set({ validationError: msg });
      throw new Error(msg);
    }
    const next = setAtPath(doc, selectedPath, parsed);
    set({
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

  loadSample: () =>
    set({
      doc: SAMPLE_DOC,
      selectedPath: [],
      documentName: "sample.json",
      sourceDraft: null,
      validationError: null,
    }),

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
