import { useState } from "react";
import { useJsonStore } from "../../store/useJsonStore";
import { pathToBreadcrumb } from "../../lib/jsonPath";
import type { JsonValue } from "../../lib/jsonPath";

export function Toolbar() {
  const setDoc = useJsonStore((s) => s.setDoc);
  const loadSample = useJsonStore((s) => s.loadSample);
  const triggerExpandAll = useJsonStore((s) => s.triggerExpandAll);
  const triggerCollapseAll = useJsonStore((s) => s.triggerCollapseAll);
  const formatSourceDraft = useJsonStore((s) => s.formatSourceDraft);
  const selectedPath = useJsonStore((s) => s.selectedPath);
  const documentName = useJsonStore((s) => s.documentName);
  const pushToast = useJsonStore((s) => s.pushToast);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handlePasteSubmit = () => {
    try {
      const parsed = JSON.parse(pasteText) as JsonValue;
      setDoc(parsed, "pasted.json");
      setPasteOpen(false);
      setPasteText("");
      setPasteError(null);
      pushToast("success", "Loaded from paste");
    } catch (err) {
      setPasteError((err as Error).message);
    }
  };

  const handleCopyPath = async () => {
    const text = pathToBreadcrumb(selectedPath);
    try {
      await navigator.clipboard.writeText(text);
      pushToast("success", `Copied path ${text}`);
    } catch (err) {
      pushToast("error", `Copy failed: ${(err as Error).message}`);
    }
  };

  const handleFormat = () => {
    try {
      formatSourceDraft();
    } catch (err) {
      pushToast("error", `Cannot format: ${(err as Error).message}`);
    }
  };

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-title">JSON Explorer</div>
        <button
          className="toolbar-btn"
          onClick={loadSample}
          title="Load the built-in sample document"
        >
          Load Sample
        </button>
        <button
          className="toolbar-btn"
          onClick={() => setPasteOpen(true)}
          title="Paste a JSON document"
        >
          Paste JSON…
        </button>
        <div className="toolbar-divider" />
        <button
          className="toolbar-btn"
          onClick={triggerExpandAll}
          title="Expand all nodes in the tree"
        >
          Expand All
        </button>
        <button
          className="toolbar-btn"
          onClick={triggerCollapseAll}
          title="Collapse all nodes in the tree"
        >
          Collapse All
        </button>
        <div className="toolbar-divider" />
        <button
          className="toolbar-btn"
          onClick={handleFormat}
          title="Pretty-print the source pane"
        >
          Format
        </button>
        <button
          className="toolbar-btn"
          onClick={handleCopyPath}
          title="Copy the selected node's path"
        >
          Copy Path
        </button>
        <div className="toolbar-spacer" />
        <span className="toolbar-doc" title={documentName}>
          {documentName}
        </span>
      </div>

      {pasteOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPasteOpen(false);
              setPasteError(null);
            }
          }}
        >
          <div className="modal" role="dialog" aria-label="Paste JSON">
            <div className="modal-header">Paste JSON</div>
            <div className="modal-body">
              <textarea
                className="input textarea"
                placeholder='{"hello": "world"}'
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setPasteError(null);
                }}
                autoFocus
              />
              {pasteError && <div className="modal-error">{pasteError}</div>}
            </div>
            <div className="modal-footer">
              <button
                className="btn"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteError(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={handlePasteSubmit}
                disabled={!pasteText.trim()}
              >
                Load
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
