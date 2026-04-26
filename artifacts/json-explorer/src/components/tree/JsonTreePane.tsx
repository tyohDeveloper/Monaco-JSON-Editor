import { useEffect, useRef } from "react";
import {
  createJSONEditor,
  Mode,
  createValueSelection,
  isJSONContent,
  isTextContent,
  type Content,
  type JSONEditorSelection,
  type JSONSelection,
} from "vanilla-jsoneditor";
import { useJsonStore } from "../../store/useJsonStore";
import type { JsonPath, JsonValue } from "../../lib/jsonPath";

interface EditorHandle {
  set?: (c: Content) => void;
  update?: (c: Content) => void;
  select?: (s: JSONEditorSelection | undefined) => void;
  destroy: () => void;
}

function vjePathToJsonPath(doc: JsonValue, vjePath: readonly string[]): JsonPath {
  const out: JsonPath = [];
  let cur: JsonValue | undefined = doc;
  for (const seg of vjePath) {
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      out.push(Number.isFinite(idx) ? idx : seg);
      cur = cur[idx as number];
    } else if (cur !== null && typeof cur === "object") {
      out.push(seg);
      cur = (cur as Record<string, JsonValue>)[seg];
    } else {
      out.push(seg);
      break;
    }
  }
  return out;
}

function extractSelectionPath(sel: JSONEditorSelection | undefined): readonly string[] | null {
  if (!sel) return null;
  // JSONSelection (tree mode) has a path; TextSelection (text mode) does not
  const anyS = sel as { path?: readonly string[]; focusPath?: readonly string[]; anchorPath?: readonly string[] };
  if (Array.isArray(anyS.path)) return anyS.path;
  if (Array.isArray(anyS.focusPath)) return anyS.focusPath;
  if (Array.isArray(anyS.anchorPath)) return anyS.anchorPath;
  return null;
}

function jsonPathToVjePath(p: JsonPath): string[] {
  return p.map((s) => String(s));
}

export function JsonTreePane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorHandle | null>(null);

  // Track values to detect external vs internal changes
  const lastDocFromEditor = useRef<JsonValue | null>(null);
  const lastSelFromEditor = useRef<string>("");

  const doc = useJsonStore((s) => s.doc);
  const selectedPath = useJsonStore((s) => s.selectedPath);
  const setDoc = useJsonStore((s) => s.setDoc);
  const setSelectedPath = useJsonStore((s) => s.setSelectedPath);

  // Mount editor once
  useEffect(() => {
    if (!containerRef.current) return;
    const editor = createJSONEditor({
      target: containerRef.current,
      props: {
        mode: Mode.tree,
        mainMenuBar: false,
        navigationBar: false,
        statusBar: false,
        askToFormat: false,
        readOnly: false,
        content: { json: useJsonStore.getState().doc as unknown },
        onChange: (updatedContent: Content) => {
          let nextJson: unknown;
          if (isJSONContent(updatedContent)) {
            nextJson = updatedContent.json;
          } else if (isTextContent(updatedContent)) {
            try {
              nextJson = JSON.parse(updatedContent.text);
            } catch {
              return; // ignore invalid intermediate states
            }
          } else {
            return;
          }
          lastDocFromEditor.current = nextJson as JsonValue;
          setDoc(nextJson as JsonValue);
        },
        onSelect: (sel: JSONEditorSelection | undefined) => {
          const p = extractSelectionPath(sel);
          if (!p) return;
          const key = p.join("\u0001");
          if (key === lastSelFromEditor.current) return;
          lastSelFromEditor.current = key;
          const jp = vjePathToJsonPath(useJsonStore.getState().doc, p);
          setSelectedPath(jp);
        },
      },
    });
    editorRef.current = editor as unknown as EditorHandle;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push doc into editor when it changes externally (e.g., source pane edited)
  useEffect(() => {
    const e = editorRef.current;
    if (!e || !e.update) return;
    if (lastDocFromEditor.current !== null && lastDocFromEditor.current === doc) {
      // change came from editor itself; skip
      lastDocFromEditor.current = null;
      return;
    }
    try {
      e.update({ json: doc as unknown });
    } catch {
      /* ignore */
    }
  }, [doc]);

  // Push selection into editor when it changes externally
  useEffect(() => {
    const e = editorRef.current;
    if (!e || !e.select) return;
    const key = selectedPath.map(String).join("\u0001");
    if (key === lastSelFromEditor.current) return;
    lastSelFromEditor.current = key;
    try {
      const sel: JSONSelection = createValueSelection(jsonPathToVjePath(selectedPath));
      e.select(sel);
    } catch {
      /* ignore: selection may be invalid for current doc */
    }
  }, [selectedPath]);

  return (
    <>
      <div className="pane-header">Tree</div>
      <div className="pane-body">
        <div className="tree-host" ref={containerRef} />
      </div>
    </>
  );
}
