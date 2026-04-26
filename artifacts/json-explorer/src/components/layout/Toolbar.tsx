import { useRef, useState } from "react";
import { useJsonStore } from "../../store/useJsonStore";
import type { JsonValue } from "../../lib/jsonPath";

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setDoc = useJsonStore((s) => s.setDoc);
  const loadSample = useJsonStore((s) => s.loadSample);
  const clearDoc = useJsonStore((s) => s.clearDoc);
  const doc = useJsonStore((s) => s.doc);
  const documentName = useJsonStore((s) => s.documentName);
  const pushToast = useJsonStore((s) => s.pushToast);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const handleOpenFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as JsonValue;
      setDoc(parsed, file.name);
      pushToast("success", `Loaded ${file.name}`);
    } catch (err) {
      pushToast("error", `Could not parse JSON: ${(err as Error).message}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleDownload = () => {
    try {
      const text = JSON.stringify(doc, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = documentName.endsWith(".json") ? documentName : `${documentName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      pushToast("success", "Downloaded");
    } catch (err) {
      pushToast("error", `Download failed: ${(err as Error).message}`);
    }
  };

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
      pushToast("success", "Copied JSON to clipboard");
    } catch (err) {
      pushToast("error", `Copy failed: ${(err as Error).message}`);
    }
  };

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

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-title">JSON Explorer</div>
        <button className="toolbar-btn" onClick={handleOpenFile} title="Open a .json file">
          Open…
        </button>
        <button className="toolbar-btn" onClick={() => setPasteOpen(true)} title="Paste JSON text">
          Paste…
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" onClick={loadSample} title="Load sample document">
          Sample
        </button>
        <button className="toolbar-btn" onClick={clearDoc} title="Start with empty object">
          New
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" onClick={handleCopyAll} title="Copy entire JSON to clipboard">
          Copy
        </button>
        <button className="toolbar-btn primary" onClick={handleDownload} title="Download JSON file">
          Download
        </button>
        <div className="toolbar-spacer" />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{documentName}</span>
        <input
          type="file"
          accept="application/json,.json,.txt"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
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
