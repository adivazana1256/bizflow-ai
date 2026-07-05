// Generic flow-engine types. Nothing here knows about any specific business.

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface EngineResult {
  status: string; // "completed" | "handover"
  action: string; // e.g. "create_order" | "book_repair" | "create_lead" | "handover"
  payload?: unknown;
}
export interface EngineReply {
  reply: string;
  result?: EngineResult;
}

// ---- Flow configuration (generic, business-agnostic) ----

/** A named choice with a price delta in minor units. */
export interface PricedOption {
  name: string;
  priceDelta: number;
}

/** A required/optional group of mutually-exclusive choices (e.g. a size). */
export interface OptionGroup {
  name: string;
  required: boolean;
  prompt?: string;
  options: PricedOption[];
}

/** A purchasable item with optional option-groups and add-ons. */
export interface CatalogItem {
  name: string;
  price: number; // minor units
  optionGroups?: OptionGroup[];
  addOns?: PricedOption[];
}

/** A field to collect from the user (name, phone, device, ...). */
export interface FlowField {
  name: string;
  prompt: string;
  required: boolean;
}

/**
 * A slot-filling flow. Selected by trigger phrases and/or catalog mentions, then
 * fills its fields and emits `action`. The engine renders `completionReply` — no
 * hardcoded wording.
 */
export interface FlowConfig {
  id: string;
  action: string;
  /** phrases/keywords that select this flow */
  triggers?: string[];
  /** optional catalog (order/booking). Absent for pure field-collection (lead). */
  catalog?: CatalogItem[];
  /** must a catalog item be chosen? defaults to true when a catalog is present */
  itemRequired?: boolean;
  itemPrompt?: string;
  quantity?: { required: boolean; prompt: string };
  fields: FlowField[];
  /**
   * Completion reply template. Placeholders: {business}, {item}, {summary},
   * {total}, {currency}, and any collected field name (e.g. {name}, {phone}).
   */
  completionReply: string;
}

export type Flow = FlowConfig;

/** Payload emitted on flow completion. */
export interface FlowPayload {
  action: string;
  items: {
    name: string;
    options: Record<string, string>;
    addOns: string[];
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  fields: Record<string, string>;
  total: number;
  currency: string;
}
