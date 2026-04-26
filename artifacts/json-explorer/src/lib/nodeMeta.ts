import type { JsonValue } from "./jsonPath";

export type NodeType = "string" | "number" | "boolean" | "null" | "object" | "array";

export function nodeType(value: JsonValue | undefined): NodeType | "undefined" {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as NodeType;
}

export function childCount(value: JsonValue | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") return Object.keys(value).length;
  return null;
}

export function valuePreview(value: JsonValue | undefined, maxLen = 60): string {
  if (value === undefined) return "(undefined)";
  if (value === null) return "null";
  if (typeof value === "string") {
    const s = JSON.stringify(value);
    return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  const keys = Object.keys(value);
  return `Object{${keys.length}}`;
}

export function isPrimitive(t: NodeType | "undefined"): boolean {
  return t === "string" || t === "number" || t === "boolean" || t === "null";
}

export function isContainer(t: NodeType | "undefined"): boolean {
  return t === "object" || t === "array";
}
