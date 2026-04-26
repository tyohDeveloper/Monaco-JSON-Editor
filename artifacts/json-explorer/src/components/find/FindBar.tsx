import { useEffect, useRef } from "react";
import { useJsonStore } from "../../store/useJsonStore";
import { pathToBreadcrumb } from "../../lib/jsonPath";
import type { FindScope } from "../../lib/jsonPath";

const SCOPE_OPTIONS: { value: FindScope; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "keys", label: "Keys" },
  { value: "values", label: "Values" },
];

export function FindBar() {
  const findOpen = useJsonStore((s) => s.findOpen);
  const closeFind = useJsonStore((s) => s.closeFind);

  const findQuery = useJsonStore((s) => s.findQuery);
  const findCaseSensitive = useJsonStore((s) => s.findCaseSensitive);
  const findScope = useJsonStore((s) => s.findScope);
  const findMatches = useJsonStore((s) => s.findMatches);
  const findIndex = useJsonStore((s) => s.findIndex);
  const setFindQuery = useJsonStore((s) => s.setFindQuery);
  const setFindCaseSensitive = useJsonStore((s) => s.setFindCaseSensitive);
  const setFindScope = useJsonStore((s) => s.setFindScope);
  const nextFindMatch = useJsonStore((s) => s.nextFindMatch);
  const prevFindMatch = useJsonStore((s) => s.prevFindMatch);

  const pathQuery = useJsonStore((s) => s.pathQuery);
  const pathMatches = useJsonStore((s) => s.pathMatches);
  const pathIndex = useJsonStore((s) => s.pathIndex);
  const pathError = useJsonStore((s) => s.pathError);
  const setPathQuery = useJsonStore((s) => s.setPathQuery);
  const nextPathMatch = useJsonStore((s) => s.nextPathMatch);
  const prevPathMatch = useJsonStore((s) => s.prevPathMatch);

  const findInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the substring input whenever the bar is opened.
  useEffect(() => {
    if (!findOpen) return;
    const t = window.setTimeout(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(t);
  }, [findOpen]);

  if (!findOpen) return null;

  const findCount = findMatches.length;
  const findStatus =
    findQuery.length === 0
      ? ""
      : findCount === 0
        ? "0 matches"
        : `${findIndex + 1} / ${findCount}`;

  const pathTrimmed = pathQuery.trim();
  const pathStatus = pathError
    ? pathError
    : pathTrimmed.length === 0
      ? ""
      : pathMatches.length === 0
        ? "0 matches"
        : `${pathIndex + 1} / ${pathMatches.length}`;

  const handleFindKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prevFindMatch();
      else nextFindMatch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeFind();
    }
  };

  const handlePathKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prevPathMatch();
      else nextPathMatch();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeFind();
    }
  };

  const activeFindPath =
    findIndex >= 0 ? findMatches[findIndex] ?? null : null;
  const activePathPath =
    pathIndex >= 0 ? pathMatches[pathIndex] ?? null : null;

  return (
    <div className="findbar" role="search" aria-label="Find in document">
      <div className="findbar-row">
        <label className="findbar-label" htmlFor="findbar-find-input">
          Find
        </label>
        <input
          id="findbar-find-input"
          ref={findInputRef}
          className="input findbar-input"
          type="text"
          placeholder="Substring in keys / values…"
          value={findQuery}
          onChange={(e) => setFindQuery(e.target.value)}
          onKeyDown={handleFindKey}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className={`findbar-toggle${findCaseSensitive ? " active" : ""}`}
          onClick={() => setFindCaseSensitive(!findCaseSensitive)}
          title="Match case"
          type="button"
          aria-pressed={findCaseSensitive}
        >
          Aa
        </button>
        <select
          className="select findbar-select"
          value={findScope}
          onChange={(e) => setFindScope(e.target.value as FindScope)}
          title="Where to search"
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          className={`findbar-count${
            findQuery.length > 0 && findCount === 0 ? " empty" : ""
          }`}
          title={
            activeFindPath ? pathToBreadcrumb(activeFindPath) : undefined
          }
        >
          {findStatus}
        </span>
        <button
          className="findbar-nav"
          onClick={prevFindMatch}
          disabled={findCount === 0}
          title="Previous match (Shift+Enter)"
          type="button"
          aria-label="Previous find match"
        >
          ↑
        </button>
        <button
          className="findbar-nav"
          onClick={nextFindMatch}
          disabled={findCount === 0}
          title="Next match (Enter)"
          type="button"
          aria-label="Next find match"
        >
          ↓
        </button>
        <button
          className="findbar-close"
          onClick={closeFind}
          title="Close (Esc)"
          type="button"
          aria-label="Close find bar"
        >
          ×
        </button>
      </div>
      <div className="findbar-row">
        <label className="findbar-label" htmlFor="findbar-path-input">
          Path
        </label>
        <input
          id="findbar-path-input"
          className={`input findbar-input mono${
            pathError ? " invalid" : ""
          }`}
          type="text"
          placeholder="JSONPath expression e.g. $.items[*].id or $..name"
          value={pathQuery}
          onChange={(e) => setPathQuery(e.target.value)}
          onKeyDown={handlePathKey}
          spellCheck={false}
          autoComplete="off"
        />
        <span
          className={`findbar-count${
            pathError
              ? " error"
              : pathTrimmed.length > 0 && pathMatches.length === 0
                ? " empty"
                : ""
          }`}
          title={
            pathError
              ? pathError
              : activePathPath
                ? pathToBreadcrumb(activePathPath)
                : undefined
          }
        >
          {pathStatus}
        </span>
        <button
          className="findbar-nav"
          onClick={prevPathMatch}
          disabled={pathMatches.length === 0}
          title="Previous match (Shift+Enter)"
          type="button"
          aria-label="Previous path match"
        >
          ↑
        </button>
        <button
          className="findbar-nav"
          onClick={nextPathMatch}
          disabled={pathMatches.length === 0}
          title="Next match (Enter)"
          type="button"
          aria-label="Next path match"
        >
          ↓
        </button>
      </div>
    </div>
  );
}
