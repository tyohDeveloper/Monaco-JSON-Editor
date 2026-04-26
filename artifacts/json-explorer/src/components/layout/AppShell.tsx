import { useEffect } from "react";
import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { PaneLayout } from "./PaneLayout";
import { JsonTreePane } from "../tree/JsonTreePane";
import { InspectorPane } from "../inspector/InspectorPane";
import { SourcePane } from "../source/SourcePane";
import { SchemaErrorsPanel } from "../schema/SchemaErrorsPanel";
import { FindBar } from "../find/FindBar";
import { useJsonStore } from "../../store/useJsonStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

function useUndoRedoHotkeys() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd on Mac, Ctrl elsewhere. Either modifier key triggers undo/redo
      // so the same shortcut works on every platform.
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;

      // Don't steal undo/redo from text inputs — the browser's built-in
      // text-field undo is more useful there.
      if (isEditableTarget(e.target)) return;

      const state = useJsonStore.getState();
      // Ctrl/Cmd+Y, or Ctrl/Cmd+Shift+Z → redo. Plain Ctrl/Cmd+Z → undo.
      if (key === "y" || (key === "z" && e.shiftKey)) {
        if (state.future.length === 0) return;
        e.preventDefault();
        state.redo();
      } else {
        if (state.past.length === 0) return;
        e.preventDefault();
        state.undo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

function useFindHotkey() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Ctrl/Cmd+F: open the find bar (focusing its input). We swallow this
      // even when triggered from inside a text field so the browser's native
      // page-find dialog doesn't steal it.
      if (mod && key === "f" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        const state = useJsonStore.getState();
        if (state.findOpen) {
          // Already open: re-focus the input via a remount-style refocus.
          state.closeFind();
          window.requestAnimationFrame(() => {
            useJsonStore.getState().openFind();
          });
        } else {
          state.openFind();
        }
        return;
      }
      // Esc: close the find bar (only if it's open and we're not actively
      // editing something else like the source pane).
      if (key === "escape") {
        const state = useJsonStore.getState();
        if (state.findOpen) {
          e.preventDefault();
          state.closeFind();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

function ToastStack() {
  const toasts = useJsonStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast"
          style={
            t.kind === "error"
              ? { background: "rgba(192, 57, 43, 0.95)" }
              : t.kind === "success"
              ? { background: "rgba(31, 122, 58, 0.95)" }
              : undefined
          }
        >
          {t.message}
        </div>
      ))}
    </>
  );
}

export function AppShell() {
  useUndoRedoHotkeys();
  useFindHotkey();
  return (
    <div className="app-shell">
      <Toolbar />
      <FindBar />
      <PaneLayout
        left={<JsonTreePane />}
        middle={<InspectorPane />}
        right={<SourcePane />}
      />
      <SchemaErrorsPanel />
      <StatusBar />
      <ToastStack />
    </div>
  );
}
