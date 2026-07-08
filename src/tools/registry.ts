import type { Tool, ToolCategory } from "./types";

// ponytail: `any` here is deliberate — a registry holds heterogeneous
// Tool<I> instances (each with its own I); callers use metadata() for
// discovery and get(name).execute(input, ctx) validates input via the
// tool's own zod schema before it runs.

export class ToolRegistry {
  private tools = new Map<string, Tool<any>>();

  register(tool: Tool<any>): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool<any> | undefined {
    return this.tools.get(name);
  }

  list(): Tool<any>[] {
    return [...this.tools.values()];
  }

  /** Discovery surface for a future Claude loop: tool definitions minus the schema/execute. */
  metadata(): { name: string; description: string; category: ToolCategory }[] {
    return this.list().map(({ name, description, category }) => ({ name, description, category }));
  }
}
