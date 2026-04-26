import type { JsonValue } from "./jsonPath";

export const SAMPLE_DOC: JsonValue = {
  app: "JSON Explorer",
  version: "1.0.0",
  user: {
    id: 42,
    name: "Ada Lovelace",
    email: "ada@example.com",
    active: true,
    roles: ["admin", "editor"],
    profile: {
      bio: "Mathematician and writer.",
      joinedAt: "1815-12-10",
      preferences: {
        theme: "light",
        compact: false,
        notifications: null,
      },
    },
  },
  items: [
    { id: 1, label: "Alpha", qty: 3, tags: ["new", "featured"] },
    { id: 2, label: "Beta", qty: 0, tags: [] },
    { id: 3, label: "Gamma", qty: 12, tags: ["sale"] },
  ],
  meta: {
    createdAt: "2026-04-26T00:00:00Z",
    flags: {
      experimental: true,
      betaUsers: 1023,
    },
  },
};
