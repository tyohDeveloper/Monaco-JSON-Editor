import { create } from "zustand";
import type { JsonPath, JsonValue } from "../lib/jsonPath";
import { pathsEqual } from "../lib/jsonPath";
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
  parseError: string | null;
  documentName: string;
  toasts: Toast[];

  setDoc: (next: JsonValue, name?: string) => void;
  setSelectedPath: (path: JsonPath) => void;
  setParseError: (err: string | null) => void;

  // Mutators throw on failure; callers handle toasts.
  applySetValue: (path: JsonPath, value: JsonValue) => void;
  applyRenameKey: (path: JsonPath, newKey: string) => void;
  applyDelete: (path: JsonPath) => void;
  applyAddChild: (parentPath: JsonPath, key: string | null, value: JsonValue) => void;

  clearDoc: () => void;
  loadSample: () => void;

  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
}

let toastCounter = 0;

export const useJsonStore = create<JsonState>((set, get) => ({
  doc: SAMPLE_DOC,
  selectedPath: [],
  parseError: null,
  documentName: "sample.json",
  toasts: [],

  setDoc: (next, name) =>
    set((s) => ({
      doc: next,
      documentName: name ?? s.documentName,
      // Note: parseError is owned by the source pane and is NOT cleared here.
    })),

  setSelectedPath: (path) => set({ selectedPath: path }),

  setParseError: (err) => set({ parseError: err }),

  applySetValue: (path, value) => {
    // setAtPath may throw; let it propagate so callers can show inline errors.
    const next = setAtPath(get().doc, path, value);
    set({ doc: next });
  },

  applyRenameKey: (path, newKey) => {
    const next = renameKey(get().doc, path, newKey);
    const newPath = path.slice(0, -1).concat(newKey);
    set({ doc: next, selectedPath: newPath });
  },

  applyDelete: (path) => {
    const next = deleteAtPath(get().doc, path);
    const sel = get().selectedPath;
    const newSel =
      pathsEqual(sel, path) || isAncestor(path, sel)
        ? path.slice(0, -1)
        : sel;
    set({ doc: next, selectedPath: newSel });
  },

  applyAddChild: (parentPath, key, value) => {
    const next = addChild(get().doc, parentPath, key, value);
    const newPath: JsonPath =
      key !== null
        ? [...parentPath, key]
        : (() => {
            const target = traverse(get().doc, parentPath);
            if (Array.isArray(target)) {
              return [...parentPath, target.length];
            }
            return parentPath;
          })();
    set({ doc: next, selectedPath: newPath });
  },

  clearDoc: () =>
    set({
      doc: {},
      selectedPath: [],
      parseError: null,
      documentName: "untitled.json",
    }),

  loadSample: () =>
    set({
      doc: SAMPLE_DOC,
      selectedPath: [],
      parseError: null,
      documentName: "sample.json",
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

function traverse(doc: JsonValue, path: JsonPath): JsonValue | undefined {
  let cur: JsonValue | undefined = doc;
  for (const seg of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof seg === "number" && Array.isArray(cur)) {
      cur = cur[seg];
    } else if (typeof cur === "object" && !Array.isArray(cur)) {
      cur = (cur as Record<string, JsonValue>)[seg as string];
    } else {
      return undefined;
    }
  }
  return cur;
}

function isAncestor(ancestor: JsonPath, descendant: JsonPath): boolean {
  if (ancestor.length >= descendant.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== descendant[i]) return false;
  }
  return true;
}

export function selectedTypeOf(state: JsonState) {
  const value = traverse(state.doc, state.selectedPath);
  return { value, type: nodeType(value), isContainer: isContainer(nodeType(value)) };
}
