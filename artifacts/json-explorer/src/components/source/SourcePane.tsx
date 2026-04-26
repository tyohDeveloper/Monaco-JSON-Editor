import Editor, { type OnMount, type Monaco } from "@monaco-editor/react";
import { useEffect, useMemo, useRef } from "react";
import type { editor } from "monaco-editor";
import { useJsonStore, safeStringify } from "../../store/useJsonStore";
import { getAtPath, pathToBreadcrumb } from "../../lib/jsonPath";

export function SourcePane() {
  const doc = useJsonStore((s) => s.doc);
  const selectedPath = useJsonStore((s) => s.selectedPath);
  const sourceDraft = useJsonStore((s) => s.sourceDraft);
  const validationError = useJsonStore((s) => s.validationError);
  const setSourceDraft = useJsonStore((s) => s.setSourceDraft);
  const applySourceDraft = useJsonStore((s) => s.applySourceDraft);
  const formatSourceDraft = useJsonStore((s) => s.formatSourceDraft);
  const pushToast = useJsonStore((s) => s.pushToast);

  const subtreeText = useMemo(
    () => safeStringify(getAtPath(doc, selectedPath)),
    [doc, selectedPath],
  );

  const dirty = sourceDraft !== null;
  const displayValue = sourceDraft ?? subtreeText;
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleApply = () => {
    if (!dirty) return;
    try {
      applySourceDraft();
      pushToast("success", "Source applied");
    } catch (err) {
      pushToast("error", `Cannot apply: ${(err as Error).message}`);
    }
  };

  const handleRevert = () => {
    setSourceDraft(null);
  };

  const handleFormat = () => {
    try {
      formatSourceDraft();
    } catch (err) {
      pushToast("error", `Cannot format: ${(err as Error).message}`);
    }
  };

  const handleChange = (val: string | undefined) => {
    const next = val ?? "";
    if (next === subtreeText) {
      // Back in sync — drop the draft
      setSourceDraft(null);
    } else {
      setSourceDraft(next);
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

  // Keep handlers fresh inside the closure registered with Monaco
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    // No-op; Monaco re-binds via React render
  });

  const breadcrumb = pathToBreadcrumb(selectedPath);

  return (
    <>
      <div className="pane-header">
        Source
        <span className="pane-header-sub" title={breadcrumb}>
          editing&nbsp;{breadcrumb}
        </span>
      </div>
      <div className="source-pane-wrap">
        <div className="source-toolbar">
          <button
            className="btn primary small"
            onClick={handleApply}
            disabled={!dirty || !!validationError}
            title="Parse and apply to selected subtree (Ctrl+S)"
          >
            Apply
          </button>
          <button
            className="btn small"
            onClick={handleRevert}
            disabled={!dirty}
            title="Discard changes and re-sync to current subtree"
          >
            Revert
          </button>
          <button
            className="btn small"
            onClick={handleFormat}
            title="Pretty-print the draft"
          >
            Format
          </button>
          <span className={`source-status${dirty ? " dirty" : ""}`}>
            {validationError ? "invalid" : dirty ? "modified" : "in sync"}
          </span>
        </div>
        {validationError && (
          <div className="source-error" title={validationError}>
            {validationError}
          </div>
        )}
        <div className="source-monaco">
          <Editor
            height="100%"
            language="json"
            theme="vs"
            value={displayValue}
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
