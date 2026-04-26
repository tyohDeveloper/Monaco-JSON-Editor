import { useJsonStore } from "../../store/useJsonStore";
import { getAtPath, pathToBreadcrumb } from "../../lib/jsonPath";
import { nodeType, childCount } from "../../lib/nodeMeta";

function byteSize(s: string): string {
  const bytes = new Blob([s]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function countNodes(value: unknown): number {
  if (value === null || typeof value !== "object") return 1;
  if (Array.isArray(value)) {
    let total = 1;
    for (const v of value) total += countNodes(v);
    return total;
  }
  let total = 1;
  for (const k of Object.keys(value as object)) {
    total += countNodes((value as Record<string, unknown>)[k]);
  }
  return total;
}

export function StatusBar() {
  const doc = useJsonStore((s) => s.doc);
  const selectedPath = useJsonStore((s) => s.selectedPath);
  const validationError = useJsonStore((s) => s.validationError);
  const schema = useJsonStore((s) => s.schema);
  const schemaErrors = useJsonStore((s) => s.schemaErrors);
  const schemaRuntimeError = useJsonStore((s) => s.schemaRuntimeError);

  const selectedValue = getAtPath(doc, selectedPath);
  const t = nodeType(selectedValue);
  const children = childCount(selectedValue);
  const breadcrumb = pathToBreadcrumb(selectedPath);
  const docText = (() => {
    try {
      return JSON.stringify(doc);
    } catch {
      return "";
    }
  })();

  return (
    <div className="statusbar">
      <span className="statusbar-item path" title={breadcrumb}>
        {breadcrumb}
      </span>
      <span className="statusbar-item">
        Type: <strong style={{ color: "var(--text)" }}>{t}</strong>
      </span>
      {children !== null && (
        <span className="statusbar-item">
          {Array.isArray(selectedValue) ? "Items" : "Keys"}: <strong style={{ color: "var(--text)" }}>{children}</strong>
        </span>
      )}
      <span className="statusbar-item">Nodes: <strong style={{ color: "var(--text)" }}>{countNodes(doc)}</strong></span>
      <span className="statusbar-item">Size: <strong style={{ color: "var(--text)" }}>{byteSize(docText)}</strong></span>
      {validationError ? (
        <span className="statusbar-item error">
          <span className="statusbar-dot err" />
          Source has errors
        </span>
      ) : (
        <span className="statusbar-item ok">
          <span className="statusbar-dot ok" />
          Valid
        </span>
      )}
      {schema !== null &&
        (schemaRuntimeError ? (
          <span
            className="statusbar-item error"
            title={`Schema validator error: ${schemaRuntimeError}`}
          >
            <span className="statusbar-dot err" />
            Schema validator error
          </span>
        ) : schemaErrors.length === 0 ? (
          <span
            className="statusbar-item ok"
            title="Document validates against the loaded JSON Schema"
          >
            <span className="statusbar-dot ok" />
            Valid against schema
          </span>
        ) : (
          <span
            className="statusbar-item error"
            title={`${schemaErrors.length} schema validation ${schemaErrors.length === 1 ? "error" : "errors"}`}
          >
            <span className="statusbar-dot err" />
            {schemaErrors.length} {schemaErrors.length === 1 ? "error" : "errors"} against schema
          </span>
        ))}
    </div>
  );
}
