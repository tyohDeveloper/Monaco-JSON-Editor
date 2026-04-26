import { useState } from "react";
import { useJsonStore, type SchemaError } from "../../store/useJsonStore";
import { pathToBreadcrumb } from "../../lib/jsonPath";

function severityClass(sev: string): string {
  if (sev === "warning") return "warn";
  if (sev === "info") return "info";
  return "err";
}

export function SchemaErrorsPanel() {
  const schema = useJsonStore((s) => s.schema);
  const schemaName = useJsonStore((s) => s.schemaName);
  const errors = useJsonStore((s) => s.schemaErrors);
  const runtimeError = useJsonStore((s) => s.schemaRuntimeError);
  const setSelectedPath = useJsonStore((s) => s.setSelectedPath);
  const clearSchema = useJsonStore((s) => s.clearSchema);
  const pushToast = useJsonStore((s) => s.pushToast);

  const [collapsed, setCollapsed] = useState(false);

  if (schema === null) return null;

  const handleErrorClick = (err: SchemaError) => {
    setSelectedPath(err.path);
  };

  const handleClear = () => {
    clearSchema();
    pushToast("info", "Schema cleared");
  };

  const count = errors.length;
  const headerLabel = runtimeError
    ? "Schema validator error"
    : count === 0
      ? "Valid against schema"
      : `${count} schema ${count === 1 ? "error" : "errors"}`;
  const headerBadgeClass = runtimeError ? "err" : count === 0 ? "ok" : "err";

  return (
    <div className={`schema-panel ${collapsed ? "collapsed" : ""}`}>
      <div className="schema-panel-header">
        <button
          className="schema-panel-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand schema errors panel" : "Collapse schema errors panel"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <span className={`schema-panel-caret ${collapsed ? "right" : "down"}`}>
            {collapsed ? "▸" : "▾"}
          </span>
        </button>
        <span className="schema-panel-title">Schema</span>
        {schemaName && (
          <span className="schema-panel-filename" title={schemaName}>
            {schemaName}
          </span>
        )}
        <span
          className={`schema-panel-count ${headerBadgeClass}`}
          aria-live="polite"
        >
          {headerLabel}
        </span>
        <span className="schema-panel-spacer" />
        <button
          className="btn small"
          onClick={handleClear}
          title="Clear the loaded schema"
        >
          Clear schema
        </button>
      </div>
      {!collapsed && (
        <div className="schema-panel-body">
          {runtimeError ? (
            <div className="schema-panel-runtime-error">
              <strong>Schema validator threw while validating the document:</strong>
              <pre className="schema-panel-runtime-error-message">
                {runtimeError}
              </pre>
            </div>
          ) : count === 0 ? (
            <div className="schema-panel-empty">
              No schema validation errors.
            </div>
          ) : (
            <ul className="schema-error-list" role="list">
              {errors.map((err, i) => (
                <li
                  key={i}
                  className={`schema-error-row ${severityClass(err.severity)}`}
                >
                  <button
                    className="schema-error-button"
                    onClick={() => handleErrorClick(err)}
                    title="Jump to this node in the tree"
                  >
                    <span className={`schema-error-dot ${severityClass(err.severity)}`} />
                    <span className="schema-error-path">
                      {pathToBreadcrumb(err.path)}
                    </span>
                    <span className="schema-error-message">{err.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
