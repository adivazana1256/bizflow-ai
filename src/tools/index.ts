import { ToolRegistry } from "./registry";
import { searchKnowledgeTool } from "./search_knowledge";
import { searchProductsTool } from "./search_products";
import { createOrderTool } from "./create_order";
import { createLeadTool } from "./create_lead";
import { bookRepairTool } from "./book_repair";
import { handoverToHumanTool } from "./handover_to_human";
import { getCustomerHistoryTool } from "./get_customer_history";

// The single surface a future Claude tool-use loop imports (see
// docs/CLIENT_ENGINE_SPEC.md §5). Scaffolding only — nothing in the running
// app calls this yet; the flow engine (src/flow/**) is unchanged.
export const toolRegistry = new ToolRegistry();

toolRegistry.register(searchKnowledgeTool);
toolRegistry.register(searchProductsTool);
toolRegistry.register(createOrderTool);
toolRegistry.register(createLeadTool);
toolRegistry.register(bookRepairTool);
toolRegistry.register(handoverToHumanTool);
toolRegistry.register(getCustomerHistoryTool);

export { ToolRegistry } from "./registry";
export type { Tool, ToolContext, ToolCategory } from "./types";
