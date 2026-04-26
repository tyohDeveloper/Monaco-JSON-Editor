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
