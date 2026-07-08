import assert from "node:assert/strict";
import { toolRegistry } from "./index";

// Offline self-check: registry wiring + zod schemas only. No DB, no network.
// Run: npx tsx src/tools/registry.check.ts

const EXPECTED_NAMES = [
  "search_knowledge",
  "search_products",
  "create_order",
  "create_lead",
  "book_repair",
  "handover_to_human",
  "get_customer_history",
];

const tools = toolRegistry.list();
assert.equal(tools.length, 7, `expected 7 tools, got ${tools.length}`);
assert.deepEqual(
  new Set(tools.map((t) => t.name)),
  new Set(EXPECTED_NAMES),
  "registered tool names don't match the expected set",
);

const meta = toolRegistry.metadata();
assert.equal(meta.length, 7);
for (const m of meta) {
  assert.ok(m.name && m.description && m.category, `metadata missing fields for ${m.name}`);
}

// Every tool has a zod inputSchema that rejects bad input and accepts good input.
for (const t of tools) {
  assert.ok(t.inputSchema.safeParse({}).success === false || t.name === "handover_to_human",
    `${t.name} should reject an empty/bad object`);
}

assert.equal(toolRegistry.get("search_products")!.inputSchema.safeParse({ query: "x" }).success, true);
assert.equal(toolRegistry.get("search_products")!.inputSchema.safeParse({}).success, false);

assert.equal(
  toolRegistry.get("create_order")!.inputSchema.safeParse({
    items: [{ name: "Widget", quantity: 1, unitPrice: 100 }],
    currency: "USD",
  }).success,
  true,
);
assert.equal(toolRegistry.get("create_order")!.inputSchema.safeParse({}).success, false);

assert.equal(toolRegistry.get("create_lead")!.inputSchema.safeParse({ name: "Jane" }).success, true);
assert.equal(toolRegistry.get("create_lead")!.inputSchema.safeParse({}).success, false);

assert.equal(
  toolRegistry.get("book_repair")!.inputSchema.safeParse({ service: "Screen fix", name: "Jane" }).success,
  true,
);
assert.equal(toolRegistry.get("book_repair")!.inputSchema.safeParse({}).success, false);

assert.equal(toolRegistry.get("handover_to_human")!.inputSchema.safeParse({}).success, true);
assert.equal(toolRegistry.get("handover_to_human")!.inputSchema.safeParse({ reason: "angry" }).success, true);

assert.equal(toolRegistry.get("get_customer_history")!.inputSchema.safeParse({ phone: "555" }).success, true);
assert.equal(toolRegistry.get("get_customer_history")!.inputSchema.safeParse({}).success, false);

assert.equal(
  toolRegistry.get("search_knowledge")!.inputSchema.safeParse({ query: "hours" }).success,
  true,
);
assert.equal(toolRegistry.get("search_knowledge")!.inputSchema.safeParse({}).success, false);

assert.ok(toolRegistry.get("create_order"), "get('create_order') should resolve");
assert.equal(toolRegistry.get("does_not_exist"), undefined);

console.log("OK: registry wiring + all 7 tool schemas validate correctly.");
