import { useState } from "react";
import { useJsonStore } from "../../store/useJsonStore";
import type { JsonPath, JsonValue } from "../../lib/jsonPath";
import { nodeType, isContainer } from "../../lib/nodeMeta";

interface Props {
  path: JsonPath;
  value: JsonValue | undefined;
}

type ChildKind = "string" | "number" | "boolean" | "null" | "object" | "array";

const DEFAULTS: Record<ChildKind, JsonValue> = {
  string: "",
  number: 0,
  boolean: false,
  null: null,
  object: {},
  array: [],
};

export function NodeActions({ path, value }: Props) {
  const applyDelete = useJsonStore((s) => s.applyDelete);
  const applyAddChild = useJsonStore((s) => s.applyAddChild);
  const pushToast = useJsonStore((s) => s.pushToast);

  const t = nodeType(value);
  const container = isContainer(t);
  const isArray = Array.isArray(value);
  const isObject = container && !isArray;

  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newKind, setNewKind] = useState<ChildKind>("string");
  const [addError, setAddError] = useState<string | null>(null);

  const handleDelete = () => {
    if (path.length === 0) {
      pushToast("error", "Cannot delete root");
      return;
    }
    if (!window.confirm("Delete this node?")) return;
    try {
      applyDelete(path);
      pushToast("success", "Node deleted");
    } catch (e) {
      pushToast("error", (e as Error).message);
    }
  };

  const handleAdd = () => {
    if (isObject) {
      if (!newKey.trim()) {
        setAddError("Key is required");
        return;
      }
      try {
        applyAddChild(path, newKey.trim(), DEFAULTS[newKind]);
        setNewKey("");
        setAddOpen(false);
        setAddError(null);
        pushToast("success", "Property added");
      } catch (e) {
        setAddError((e as Error).message);
      }
    } else if (isArray) {
      try {
        applyAddChild(path, null, DEFAULTS[newKind]);
        setAddOpen(false);
        setAddError(null);
        pushToast("success", "Item appended");
      } catch (e) {
        setAddError((e as Error).message);
      }
    }
  };

  return (
    <>
      <div className="field-group">
        <div className="field-label">Actions</div>
        <div className="actions-row">
          {container && (
            <button className="btn" onClick={() => setAddOpen((o) => !o)}>
              {isArray ? "Append item…" : "Add property…"}
            </button>
          )}
          <button
            className="btn danger"
            onClick={handleDelete}
            disabled={path.length === 0}
            title={path.length === 0 ? "Cannot delete root" : "Delete this node"}
          >
            Delete
          </button>
        </div>
      </div>

      {container && addOpen && (
        <div className="field-group" style={{ borderTop: "1px dashed var(--divider)", paddingTop: 10 }}>
          <div className="field-label">{isArray ? "New item" : "New property"}</div>
          {isObject && (
            <div className="field-row">
              <input
                className={`input${addError ? " invalid" : ""}`}
                placeholder="key"
                value={newKey}
                onChange={(e) => {
                  setNewKey(e.target.value);
                  setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
                autoFocus
              />
            </div>
          )}
          <div className="field-row">
            <select
              className="select"
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as ChildKind)}
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="null">null</option>
              <option value="object">object {"{}"}</option>
              <option value="array">array []</option>
            </select>
            <button className="btn primary" onClick={handleAdd}>
              Add
            </button>
            <button
              className="btn"
              onClick={() => {
                setAddOpen(false);
                setAddError(null);
              }}
            >
              Cancel
            </button>
          </div>
          {addError && <div className="modal-error">{addError}</div>}
        </div>
      )}
    </>
  );
}
