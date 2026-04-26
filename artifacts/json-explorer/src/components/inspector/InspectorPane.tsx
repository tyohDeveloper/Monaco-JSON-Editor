import { useJsonStore } from "../../store/useJsonStore";
import { getAtPath, lastSegment } from "../../lib/jsonPath";
import { nodeType, isPrimitive } from "../../lib/nodeMeta";
import { BreadcrumbPath } from "./BreadcrumbPath";
import { NodeSummary } from "./NodeSummary";
import { KeyRenameField } from "./KeyRenameField";
import { PrimitiveEditor } from "./PrimitiveEditor";
import { NodeActions } from "./NodeActions";

export function InspectorPane() {
  const doc = useJsonStore((s) => s.doc);
  const selectedPath = useJsonStore((s) => s.selectedPath);

  const value = getAtPath(doc, selectedPath);
  const t = nodeType(value);
  const seg = lastSegment(selectedPath);
  const isObjectKey = typeof seg === "string";

  if (t === "undefined") {
    return (
      <>
        <div className="pane-header">Inspector</div>
        <div className="pane-body">
          <div className="inspector-empty">
            The selected path no longer exists.<br />
            Select a node in the tree.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pane-header">Inspector</div>
      <div className="pane-body">
        <div className="inspector">
          <BreadcrumbPath path={selectedPath} />
          <NodeSummary path={selectedPath} value={value} />
          {isObjectKey && <KeyRenameField path={selectedPath} />}
          {isPrimitive(t) && <PrimitiveEditor path={selectedPath} value={value} />}
          <NodeActions path={selectedPath} value={value} />
        </div>
      </div>
    </>
  );
}
