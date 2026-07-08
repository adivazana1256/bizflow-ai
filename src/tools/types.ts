import type { z } from "zod";

// Generic Tool Registry types for the future Claude tool-use loop (see
// docs/CLIENT_ENGINE_SPEC.md §5). Tools are thin wrappers over existing
// server functions — the AI never touches business logic/DB directly.

export type ToolCategory = "knowledge" | "catalog" | "orders" | "leads" | "repairs" | "support" | "customers";

/**
 * Runtime context a caller (the future Claude loop) supplies per turn. Tools
 * never guess tenant/identity — businessId, channel, and the customer's id
 * always come from here.
 */
export interface ToolContext {
  businessId: string;
  channel?: string;
  externalId?: string;
  conversationId?: string;
  idempotencyKey?: string;
}

export interface Tool<I> {
  name: string;
  description: string;
  category: ToolCategory;
  /** Validates raw input now; convertible to a Claude JSON schema at integration time.
   *  Def/Input generics left open so schemas using .default()/.refine() (whose
   *  z.input type differs from z.infer/output) still satisfy Tool<I>. */
  inputSchema: z.ZodType<I, z.ZodTypeDef, any>;
  execute(input: I, ctx: ToolContext): Promise<unknown>;
}
