import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { useJsonStore } from "../../store/useJsonStore";

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

export function SourcePane() {
  const doc = useJsonStore((s) => s.doc);
  const setDoc = useJsonStore((s) => s.setDoc);
  const setParseError = useJsonStore((s) => s.setParseError);
  const pushToast = useJsonStore((s) => s.pushToast);
  const parseError = useJsonStore((s) => s.parseError);

  const formatted = useMemo(() => safeStringify(doc), [doc]);

  const [draft, setDraft] = useState<string>(formatted);
  const [dirty, setDirty] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const lastFormattedRef = useRef<string>(formatted);

  // When external doc changes (and we're not dirty), pull it in
  useEffect(() => {
    if (!dirty) {
      setDraft(formatted);
      lastFormattedRef.current = formatted;
      setLocalError(null);
      setParseError(null);
    }
  }, [formatted, dirty, setParseError]);

  const handleChange = (val: string | undefined) => {
    const next = val ?? "";
    setDraft(next);
    if (next === lastFormattedRef.current) {
      setDirty(false);
      setLocalError(null);
      setParseError(null);
      return;
    }
    setDirty(true);
    try {
      JSON.parse(next);
      setLocalError(null);
      setParseError(null);
    } catch (err) {
      const msg = (err as Error).message;
      setLocalError(msg);
      setParseError(msg);
    }
  };

  const handleApply = () => {
    try {
      const parsed = JSON.parse(draft);
      setDoc(parsed);
      setDirty(false);
      setLocalError(null);
      setParseError(null);
      pushToast("success", "Source applied to document");
    } catch (err) {
      const msg = (err as Error).message;
      setLocalError(msg);
      setParseError(msg);
      pushToast("error", "Cannot apply: invalid JSON");
    }
  };

  const handleRevert = () => {
    setDraft(formatted);
    lastFormattedRef.current = formatted;
    setDirty(false);
    setLocalError(null);
    setParseError(null);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(draft);
      const next = JSON.stringify(parsed, null, 2);
      setDraft(next);
      setLocalError(null);
      // dirty if differs from doc
      if (next !== formatted) {
        setDirty(true);
      } else {
        setDirty(false);
      }
    } catch (err) {
      pushToast("error", `Cannot format: ${(err as Error).message}`);
    }
  };

  const handleMount: OnMount = (ed, monaco: Monaco) => {
    editorRef.current = ed;
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: false,
    });
    ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleApply();
    });
  };

  return (
    <>
      <div className="pane-header">Source</div>
      <div className="source-pane-wrap">
        <div className="source-toolbar">
          <button
            className="btn primary small"
            onClick={handleApply}
            disabled={!dirty || !!localError}
            title="Parse and apply (Ctrl+S)"
          >
            Apply
          </button>
          <button
            className="btn small"
            onClick={handleRevert}
            disabled={!dirty}
            title="Discard changes and revert to current document"
          >
            Revert
          </button>
          <button className="btn small" onClick={handleFormat} title="Pretty-print">
            Format
          </button>
          <span className={`source-status${dirty ? " dirty" : ""}`}>
            {localError ? "invalid" : dirty ? "modified" : "in sync"}
          </span>
        </div>
        {(localError || parseError) && (
          <div className="source-error" title={localError || parseError || ""}>
            {localError || parseError}
          </div>
        )}
        <div className="source-monaco">
          <Editor
            height="100%"
            language="json"
            theme="vs"
            value={draft}
            onChange={handleChange}
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily:
                '"SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "off",
              folding: true,
              renderWhitespace: "none",
              smoothScrolling: false,
            }}
          />
        </div>
      </div>
    </>
  );
}
