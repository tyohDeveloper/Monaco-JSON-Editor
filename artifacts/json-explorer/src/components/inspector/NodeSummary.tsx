import type { JsonPath, JsonValue } from "../../lib/jsonPath";
import { lastSegment, parentPath } from "../../lib/jsonPath";
import { nodeType, childCount, valuePreview, type NodeType } from "../../lib/nodeMeta";

interface Props {
  path: JsonPath;
  value: JsonValue | undefined;
}

export function NodeSummary({ path, value }: Props) {
  const t = nodeType(value);
  const tBadge = t === "undefined" ? "null" : (t as NodeType);
  const seg = lastSegment(path);
  const parent = parentPath(path);
  const parentLabel =
    parent === null
      ? "—"
      : parent.length === 0
      ? "$ (root)"
      : `${typeof seg === "number" ? "Array index in " : "Key in "} ${parent.join(" › ")}`;
  const count = childCount(value);

  return (
    <div className="summary-grid">
      <div className="summary-label">Type</div>
      <div className="summary-value">
        <span className={`type-badge ${tBadge}`}>{t}</span>
      </div>
      {seg !== null && (
        <>
          <div className="summary-label">{typeof seg === "number" ? "Index" : "Key"}</div>
          <div className="summary-value">{String(seg)}</div>
        </>
      )}
      <div className="summary-label">Parent</div>
      <div className="summary-value">{parentLabel}</div>
      {count !== null && (
        <>
          <div className="summary-label">{Array.isArray(value) ? "Items" : "Keys"}</div>
          <div className="summary-value">{count}</div>
        </>
      )}
      <div className="summary-label">Preview</div>
      <div className="summary-value">{valuePreview(value, 120)}</div>
    </div>
  );
}
