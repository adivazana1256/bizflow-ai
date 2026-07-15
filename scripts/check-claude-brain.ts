// Offline self-check for the Claude brain wiring (no network/API key needed).
// Run: npx tsx scripts/check-claude-brain.ts
import assert from "node:assert";
import { toolRegistry } from "../src/tools";
import { toClaudeTools } from "../src/ai/tool-adapter";
import { respond } from "../src/ai/engine";

async function main() {
  const defs = toClaudeTools(toolRegistry.list());
  assert.strictEqual(defs.length, 7, `expected 7 tools, got ${defs.length}`);
  for (const d of defs) {
    assert.ok(typeof d.name === "string" && d.name.length > 0, "name");
    assert.ok(typeof d.description === "string" && d.description.length > 0, "description");
    assert.strictEqual(d.input_schema.type, "object", `${d.name} input_schema.type`);
  }
  console.log("toClaudeTools OK:", defs.map((d) => d.name).join(", "));

  delete process.env.ANTHROPIC_API_KEY;
  const out = await respond([{ role: "user", content: "hi" }]);
  assert.strictEqual(out.mock, true, "expected mock:true on fallback path");
  assert.ok(typeof out.reply === "string" && out.reply.length > 0, "expected a reply");
  console.log("fallback OK: mock=true, reply=", JSON.stringify(out.reply.slice(0, 60)));
}

main()
  .then(() => console.log("ALL CHECKS PASSED"))
  .catch((e) => {
    console.error("CHECK FAILED:", e);
    process.exit(1);
  });