import { useEffect, useState } from "react";
import { useJsonStore } from "../../store/useJsonStore";
import type { JsonPath, JsonValue } from "../../lib/jsonPath";
import { nodeType } from "../../lib/nodeMeta";

interface Props {
  path: JsonPath;
  value: JsonValue | undefined;
}

type EditableType = "string" | "number" | "boolean" | "null";

export function PrimitiveEditor({ path, value }: Props) {
  const applySetValue = useJsonStore((s) => s.applySetValue);
  const pushToast = useJsonStore((s) => s.pushToast);

  const t = nodeType(value);

  const [typeDraft, setTypeDraft] = useState<EditableType>(
    t === "string" || t === "number" || t === "boolean" || t === "null" ? t : "string",
  );
  const [strDraft, setStrDraft] = useState<string>(typeof value === "string" ? value : "");
  const [numDraft, setNumDraft] = useState<string>(typeof value === "number" ? String(value) : "0");
  const [boolDraft, setBoolDraft] = useState<boolean>(typeof value === "boolean" ? value : false);
  const [numError, setNumError] = useState<string | null>(null);

  useEffect(() => {
    const newType: EditableType =
      t === "string" || t === "number" || t === "boolean" || t === "null" ? t : "string";
    setTypeDraft(newType);
    setStrDraft(typeof value === "string" ? value : "");
    setNumDraft(typeof value === "number" ? String(value) : "0");
    setBoolDraft(typeof value === "boolean" ? value : false);
    setNumError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path.join("\u0001"), t]);

  const handleApplyValue = () => {
    let next: JsonValue;
    if (typeDraft === "string") {
      next = strDraft;
    } else if (typeDraft === "number") {
      const n = Number(numDraft);
      if (numDraft.trim() === "" || !Number.isFinite(n)) {
        setNumError("Not a valid number");
        return;
      }
      setNumError(null);
      next = n;
    } else if (typeDraft === "boolean") {
      next = boolDraft;
    } else {
      next = null;
    }
    try {
      applySetValue(path, next);
      pushToast("success", "Value updated");
    } catch (e) {
      pushToast("error", (e as Error).message);
    }
  };

  const handleConvertContainer = (kind: "object" | "array") => {
    const next: JsonValue = kind === "object" ? {} : [];
    try {
      applySetValue(path, next);
      pushToast("success", `Converted to ${kind}`);
    } catch (e) {
      pushToast("error", (e as Error).message);
    }
  };

  return (
    <>
      <div className="field-group">
        <label className="field-label">Type</label>
        <div className="field-row">
          <select
            className="select"
            value={typeDraft}
            onChange={(e) => setTypeDraft(e.target.value as EditableType)}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="null">null</option>
          </select>
          <button
            className="btn"
            onClick={() => handleConvertContainer("object")}
            title="Replace this primitive with an empty object"
          >
            → {"{}"}
          </button>
          <button
            className="btn"
            onClick={() => handleConvertContainer("array")}
            title="Replace this primitive with an empty array"
          >
            → []
          </button>
        </div>
      </div>

      {typeDraft === "string" && (
        <div className="field-group">
          <label className="field-label">Value</label>
          <textarea
            className="input textarea"
            value={strDraft}
            onChange={(e) => setStrDraft(e.target.value)}
          />
        </div>
      )}

      {typeDraft === "number" && (
        <div className="field-group">
          <label className="field-label">Value</label>
          <input
            className={`input${numError ? " invalid" : ""}`}
            value={numDraft}
            onChange={(e) => {
              setNumDraft(e.target.value);
              setNumError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApplyValue();
            }}
          />
          {numError && <div className="modal-error">{numError}</div>}
        </div>
      )}

      {typeDraft === "boolean" && (
        <div className="field-group">
          <label className="field-label">Value</label>
          <div className="field-row">
            <select
              className="select"
              value={boolDraft ? "true" : "false"}
              onChange={(e) => setBoolDraft(e.target.value === "true")}
            >
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        </div>
      )}

      {typeDraft === "null" && (
        <div className="field-group">
          <label className="field-label">Value</label>
          <div className="summary-value" style={{ padding: "5px 0" }}>null</div>
        </div>
      )}

      <div className="field-row">
        <button className="btn primary" onClick={handleApplyValue}>
          Apply
        </button>
      </div>
    </>
  );
}
