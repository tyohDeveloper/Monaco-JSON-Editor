import { create } from "zustand";
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

  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
}

let toastCounter = 0;

export const useJsonStore = create<JsonState>((set, get) => ({
  doc: SAMPLE_DOC,
  selectedPath: [],
  documentName: "sample.json",
  toasts: [],

  sourceDraft: null,
  validationError: null,

  expandAllTick: 0,
  collapseAllTick: 0,

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
