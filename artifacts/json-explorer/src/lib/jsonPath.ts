export type JsonPath = (string | number)[];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export function getAtPath(doc: JsonValue, path: JsonPath): JsonValue | undefined {
  let cur: JsonValue | undefined = doc;
  for (const seg of path) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof seg === "number") {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[seg];
    } else {
      if (typeof cur !== "object" || Array.isArray(cur)) return undefined;
      cur = (cur as JsonObject)[seg];
    }
  }
  return cur;
}

export function pathToBreadcrumb(path: JsonPath): string {
  if (path.length === 0) return "$";
  let out = "$";
  for (const seg of path) {
    if (typeof seg === "number") {
      out += `[${seg}]`;
    } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}

export function pathsEqual(a: JsonPath, b: JsonPath): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function parentPath(path: JsonPath): JsonPath | null {
  if (path.length === 0) return null;
  return path.slice(0, -1);
}

export function lastSegment(path: JsonPath): string | number | null {
  if (path.length === 0) return null;
  return path[path.length - 1]!;
}

// --- JSONPath evaluator ------------------------------------------------------
//
// Supports a useful subset of JSONPath: `$` root, `.key`, `['key']`, `["key"]`,
// `[index]`, `[start:end:step]`, `*` / `[*]` wildcards, and `..` recursive
// descent. Filter expressions (`[?(...)]`) and script expressions are not
// supported and will be rejected as syntax errors.
//
// Examples:
//   $                     -> [[]]
//   $.user.name           -> [["user", "name"]]
//   $['user']['name']     -> [["user", "name"]]
//   $.items[*].id         -> [["items", 0, "id"], ["items", 1, "id"], ...]
//   $..name               -> every "name" property anywhere in the document
//   $.items[0:2]          -> first two items

interface PathStep {
  // True when the previous "." is actually ".." (recursive descent).
  recursive: boolean;
  selector:
    | { kind: "name"; name: string }
    | { kind: "index"; index: number }
    | {
        kind: "slice";
        start: number | null;
        end: number | null;
        step: number;
      }
    | { kind: "wild" };
}

function parseJsonPathExpression(input: string): PathStep[] {
  const s = input.trim();
  if (s.length === 0) throw new Error("JSONPath expression is empty");
  let i = 0;
  if (s[i] === "$") i++;
  const steps: PathStep[] = [];
  while (i < s.length) {
    let recursive = false;
    if (s[i] === ".") {
      i++;
      if (s[i] === ".") {
        recursive = true;
        i++;
      }
      // After a dot we expect either `*`, an identifier, or a `[...]` subscript.
      if (i >= s.length) {
        throw new Error("Unexpected end of expression after '.'");
      }
    } else if (s[i] !== "[") {
      throw new Error(
        `Unexpected character '${s[i]}' at position ${i} (expected '.' or '[')`,
      );
    }
    if (s[i] === "[") {
      i++;
      const end = findMatchingBracket(s, i);
      if (end === -1) throw new Error("Unmatched '[' in expression");
      const content = s.slice(i, end).trim();
      i = end + 1;
      steps.push({ recursive, selector: parseSubscript(content) });
    } else if (s[i] === "*") {
      i++;
      steps.push({ recursive, selector: { kind: "wild" } });
    } else {
      const m = /^[A-Za-z_$][A-Za-z0-9_$\-]*/.exec(s.slice(i));
      if (!m) {
        throw new Error(
          `Invalid identifier at position ${i}: '${s[i]}'`,
        );
      }
      steps.push({
        recursive,
        selector: { kind: "name", name: m[0] },
      });
      i += m[0].length;
    }
  }
  return steps;
}

function findMatchingBracket(s: string, from: number): number {
  // The supported subset never nests brackets inside subscripts; just find
  // the next `]`, but skip ones that appear inside quoted strings.
  let i = from;
  while (i < s.length) {
    const c = s[i];
    if (c === "'" || c === '"') {
      const quote = c;
      i++;
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\") i++;
        i++;
      }
      if (i >= s.length) return -1;
      i++; // consume closing quote
      continue;
    }
    if (c === "]") return i;
    i++;
  }
  return -1;
}

function parseSubscript(content: string): PathStep["selector"] {
  if (content === "*") return { kind: "wild" };
  if (
    (content.startsWith("'") && content.endsWith("'")) ||
    (content.startsWith('"') && content.endsWith('"'))
  ) {
    const raw = content.slice(1, -1);
    // Unescape simple backslash escapes so users can match keys with quotes.
    const unescaped = raw.replace(/\\(.)/g, "$1");
    return { kind: "name", name: unescaped };
  }
  if (/^-?\d+$/.test(content)) {
    return { kind: "index", index: Number(content) };
  }
  if (content.includes(":")) {
    const parts = content.split(":");
    if (parts.length > 3) {
      throw new Error(`Invalid slice subscript: '[${content}]'`);
    }
    const parseSlicePart = (p: string | undefined): number | null => {
      if (p === undefined || p === "") return null;
      if (!/^-?\d+$/.test(p)) {
        throw new Error(`Invalid slice subscript: '[${content}]'`);
      }
      return Number(p);
    };
    const start = parseSlicePart(parts[0]);
    const end = parseSlicePart(parts[1]);
    const stepRaw = parts[2];
    const step =
      stepRaw === undefined || stepRaw === "" ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step === 0) {
      throw new Error(`Invalid slice step in '[${content}]'`);
    }
    return { kind: "slice", start, end, step };
  }
  throw new Error(`Unsupported subscript: '[${content}]'`);
}

interface FrontierNode {
  value: JsonValue | undefined;
  path: JsonPath;
}

function expandDescendants(seeds: FrontierNode[]): FrontierNode[] {
  const out: FrontierNode[] = [];
  // Pre-order so the original "self" node is visited before its children,
  // matching how most JSONPath implementations order recursive results.
  const stack: FrontierNode[] = [...seeds].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    out.push(node);
    const v = node.value;
    if (Array.isArray(v)) {
      // Push in reverse so we pop in array order.
      for (let idx = v.length - 1; idx >= 0; idx--) {
        stack.push({ value: v[idx], path: [...node.path, idx] });
      }
    } else if (v !== null && typeof v === "object") {
      const keys = Object.keys(v as JsonObject);
      for (let k = keys.length - 1; k >= 0; k--) {
        const key = keys[k]!;
        stack.push({
          value: (v as JsonObject)[key],
          path: [...node.path, key],
        });
      }
    }
  }
  return out;
}

function applyStep(seeds: FrontierNode[], step: PathStep): FrontierNode[] {
  const sources = step.recursive ? expandDescendants(seeds) : seeds;
  const next: FrontierNode[] = [];
  for (const node of sources) {
    const v = node.value;
    switch (step.selector.kind) {
      case "name": {
        if (
          v !== null &&
          typeof v === "object" &&
          !Array.isArray(v) &&
          Object.prototype.hasOwnProperty.call(v, step.selector.name)
        ) {
          next.push({
            value: (v as JsonObject)[step.selector.name],
            path: [...node.path, step.selector.name],
          });
        }
        break;
      }
      case "index": {
        if (Array.isArray(v)) {
          const raw = step.selector.index;
          const idx = raw < 0 ? v.length + raw : raw;
          if (idx >= 0 && idx < v.length) {
            next.push({ value: v[idx], path: [...node.path, idx] });
          }
        }
        break;
      }
      case "slice": {
        if (Array.isArray(v)) {
          const len = v.length;
          const sl = step.selector;
          let start: number;
          let end: number;
          if (sl.step > 0) {
            start =
              sl.start === null
                ? 0
                : sl.start < 0
                  ? Math.max(len + sl.start, 0)
                  : Math.min(sl.start, len);
            end =
              sl.end === null
                ? len
                : sl.end < 0
                  ? Math.max(len + sl.end, 0)
                  : Math.min(sl.end, len);
            for (let k = start; k < end; k += sl.step) {
              next.push({ value: v[k], path: [...node.path, k] });
            }
          } else {
            start =
              sl.start === null
                ? len - 1
                : sl.start < 0
                  ? Math.max(len + sl.start, -1)
                  : Math.min(sl.start, len - 1);
            end =
              sl.end === null
                ? -1
                : sl.end < 0
                  ? Math.max(len + sl.end, -1)
                  : Math.min(sl.end, len - 1);
            for (let k = start; k > end; k += sl.step) {
              if (k < 0 || k >= len) continue;
              next.push({ value: v[k], path: [...node.path, k] });
            }
          }
        }
        break;
      }
      case "wild": {
        if (Array.isArray(v)) {
          v.forEach((child, idx) => {
            next.push({ value: child, path: [...node.path, idx] });
          });
        } else if (v !== null && typeof v === "object") {
          for (const key of Object.keys(v as JsonObject)) {
            next.push({
              value: (v as JsonObject)[key],
              path: [...node.path, key],
            });
          }
        }
        break;
      }
    }
  }
  return next;
}

export function evaluateJsonPath(doc: JsonValue, expr: string): JsonPath[] {
  const steps = parseJsonPathExpression(expr);
  let frontier: FrontierNode[] = [{ value: doc, path: [] }];
  for (const step of steps) {
    frontier = applyStep(frontier, step);
    if (frontier.length === 0) return [];
  }
  return frontier.map((n) => n.path);
}

// --- Substring search -------------------------------------------------------

export type FindScope = "keys" | "values" | "both";

export interface FindOptions {
  caseSensitive: boolean;
  scope: FindScope;
}

export function findInDoc(
  doc: JsonValue,
  query: string,
  opts: FindOptions,
): JsonPath[] {
  if (query.length === 0) return [];
  const needle = opts.caseSensitive ? query : query.toLowerCase();
  const includes = (haystack: string): boolean =>
    (opts.caseSensitive ? haystack : haystack.toLowerCase()).includes(needle);
  const matches: JsonPath[] = [];
  const walk = (
    value: JsonValue,
    path: JsonPath,
    fromKey: string | null,
  ): void => {
    let matched = false;
    if (opts.scope !== "values" && fromKey !== null && includes(fromKey)) {
      matched = true;
    }
    if (!matched && opts.scope !== "keys") {
      if (value === null) {
        if (includes("null")) matched = true;
      } else if (typeof value === "string") {
        if (includes(value)) matched = true;
      } else if (typeof value === "number" || typeof value === "boolean") {
        if (includes(String(value))) matched = true;
      }
    }
    if (matched) matches.push(path);
    if (Array.isArray(value)) {
      value.forEach((child, idx) => {
        walk(child, [...path, idx], null);
      });
    } else if (value !== null && typeof value === "object") {
      for (const key of Object.keys(value as JsonObject)) {
        walk((value as JsonObject)[key], [...path, key], key);
      }
    }
  };
  walk(doc, [], null);
  return matches;
}
