import type { JsonPath, JsonValue, JsonObject, JsonArray } from "./jsonPath";

function clone<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(clone) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as object)) {
    out[k] = clone((v as Record<string, unknown>)[k]);
  }
  return out as T;
}

export function setAtPath(
  doc: JsonValue,
  path: JsonPath,
  value: JsonValue,
): JsonValue {
  if (path.length === 0) {
    return clone(value);
  }
  const root = clone(doc);
  let parent: JsonValue = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!;
    if (typeof seg === "number") {
      if (!Array.isArray(parent)) {
        throw new Error(
          `Path mismatch at ${i}: expected array, got ${typeof parent}`,
        );
      }
      parent = (parent as JsonArray)[seg]!;
    } else {
      if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
        throw new Error(
          `Path mismatch at ${i}: expected object, got ${parent === null ? "null" : typeof parent}`,
        );
      }
      parent = (parent as JsonObject)[seg]!;
    }
  }
  const last = path[path.length - 1]!;
  if (typeof last === "number") {
    if (!Array.isArray(parent)) {
      throw new Error("Path mismatch at end: expected array");
    }
    (parent as JsonArray)[last] = clone(value);
  } else {
    if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
      throw new Error("Path mismatch at end: expected object");
    }
    (parent as JsonObject)[last] = clone(value);
  }
  return root;
}

export function deleteAtPath(doc: JsonValue, path: JsonPath): JsonValue {
  if (path.length === 0) {
    return null;
  }
  const root = clone(doc);
  let parent: JsonValue = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!;
    if (typeof seg === "number") {
      parent = (parent as JsonArray)[seg]!;
    } else {
      parent = (parent as JsonObject)[seg]!;
    }
  }
  const last = path[path.length - 1]!;
  if (typeof last === "number") {
    if (!Array.isArray(parent)) {
      throw new Error("Cannot delete index from non-array");
    }
    (parent as JsonArray).splice(last, 1);
  } else {
    if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
      throw new Error("Cannot delete key from non-object");
    }
    delete (parent as JsonObject)[last];
  }
  return root;
}

export function renameKey(
  doc: JsonValue,
  path: JsonPath,
  newKey: string,
): JsonValue {
  if (path.length === 0) {
    throw new Error("Cannot rename root");
  }
  const last = path[path.length - 1]!;
  if (typeof last === "number") {
    throw new Error("Cannot rename array index");
  }
  if (newKey === last) return doc;

  const root = clone(doc);
  let parent: JsonValue = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i]!;
    if (typeof seg === "number") {
      parent = (parent as JsonArray)[seg]!;
    } else {
      parent = (parent as JsonObject)[seg]!;
    }
  }
  if (typeof parent !== "object" || parent === null || Array.isArray(parent)) {
    throw new Error("Parent is not an object");
  }
  const obj = parent as JsonObject;
  if (Object.prototype.hasOwnProperty.call(obj, newKey)) {
    throw new Error(`Key "${newKey}" already exists in parent`);
  }
  // Preserve insertion order: rebuild with renamed key in original position
  const entries = Object.entries(obj);
  const idx = entries.findIndex(([k]) => k === last);
  if (idx === -1) throw new Error(`Key "${last}" not found`);
  entries[idx] = [newKey, entries[idx]![1]!];
  for (const k of Object.keys(obj)) delete obj[k];
  for (const [k, v] of entries) obj[k] = v;
  return root;
}

export function addChild(
  doc: JsonValue,
  parentPath: JsonPath,
  key: string | null,
  value: JsonValue,
): JsonValue {
  const root = clone(doc);
  let target: JsonValue = root;
  for (let i = 0; i < parentPath.length; i++) {
    const seg = parentPath[i]!;
    if (typeof seg === "number") {
      target = (target as JsonArray)[seg]!;
    } else {
      target = (target as JsonObject)[seg]!;
    }
  }
  if (Array.isArray(target)) {
    (target as JsonArray).push(clone(value));
  } else if (typeof target === "object" && target !== null) {
    if (!key) {
      throw new Error("Key is required when adding to an object");
    }
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      throw new Error(`Key "${key}" already exists`);
    }
    (target as JsonObject)[key] = clone(value);
  } else {
    throw new Error("Cannot add child to a primitive");
  }
  return root;
}
