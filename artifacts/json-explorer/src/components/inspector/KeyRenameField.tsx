import { useEffect, useState } from "react";
import { useJsonStore } from "../../store/useJsonStore";
import type { JsonPath } from "../../lib/jsonPath";
import { lastSegment } from "../../lib/jsonPath";

interface Props {
  path: JsonPath;
}

export function KeyRenameField({ path }: Props) {
  const seg = lastSegment(path);
  const applyRenameKey = useJsonStore((s) => s.applyRenameKey);
  const pushToast = useJsonStore((s) => s.pushToast);

  const [draft, setDraft] = useState<string>(typeof seg === "string" ? seg : "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(typeof seg === "string" ? seg : "");
    setError(null);
  }, [seg, path.length]);

  if (typeof seg !== "string") return null; // root or array index

  const handleRename = () => {
    if (!draft) {
      setError("Key cannot be empty");
      return;
    }
    if (draft === seg) return;
    try {
      applyRenameKey(path, draft);
      pushToast("success", "Key renamed");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="field-group">
      <label className="field-label">Key</label>
      <div className="field-row">
        <input
          className={`input${error ? " invalid" : ""}`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") {
              setDraft(seg);
              setError(null);
            }
          }}
        />
        <button
          className="btn"
          onClick={handleRename}
          disabled={draft === seg || !draft}
        >
          Rename
        </button>
      </div>
      {error && <div className="modal-error">{error}</div>}
    </div>
  );
}
