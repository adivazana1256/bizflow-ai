import type { Flow, OptionGroup, PricedOption, FlowConfig } from "../flow/types";

// Business config contract. The merged result the flow engine consumes. It is
// produced by the package loader from a Template + a Client (see loader.ts).

export interface BusinessHour {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  open: string; // "HH:MM" 24h, business timezone
  close: string;
  closed?: boolean;
}

export interface KnowledgeEntry {
  title: string;
  content: string;
  category?: string;
}

export interface StaffSeed {
  fullName: string;
  email: string;
  role: "owner" | "staff";
  /** plaintext — hashed by scripts/seed.ts, never persisted as-is */
  password: string;
}

export interface HandoverRules {
  onComplaint: boolean;
  onLowConfidence: boolean;
  confidenceThreshold?: number;
  onRequest: boolean;
}

export interface BusinessConfig {
  name: string;
  businessType: string;
  currency: string; // ISO 4217
  timezone: string; // IANA
  locale?: string;

  hours: BusinessHour[];
  persona: { systemPrompt: string; language?: string };
  flows: Flow[];
  knowledge?: KnowledgeEntry[];
  handover: HandoverRules;
  staff: StaffSeed[];

  // Client metadata carried through for future use (not read by the engine yet).
  branding?: { logo?: string };
  deliveryZones?: string[];
  phones?: string[];
}

// ---- Template + Client (merged by the package loader) ----

// A template flow is a flow definition without client data. `usesCatalog` marks
// the flow that receives the client's catalog (menu/services) at load time.
export type TemplateFlow = Omit<FlowConfig, "catalog"> & { usesCatalog?: boolean };

export interface TemplateConfig {
  templateId: string;
  businessType: string;
  persona: { systemPrompt: string; language?: string };
  capabilities?: string[];
  /** reusable named option groups (e.g. "size") a client's items can reference */
  optionGroups?: Record<string, OptionGroup>;
  flows: TemplateFlow[];
}

export interface ClientCatalogItem {
  name: string;
  price: number; // minor units
  /** names of template option groups to attach (e.g. ["size"]) */
  optionGroupRefs?: string[];
  /** inline option groups specific to this item */
  optionGroups?: OptionGroup[];
  addOns?: PricedOption[];
}

export interface ClientConfig {
  clientId: string;
  templateId: string;

  name: string;
  currency: string;
  timezone: string;
  locale?: string;

  branding?: { logo?: string };
  hours: BusinessHour[];
  deliveryZones?: string[];
  phones?: string[];
  staff: StaffSeed[];
  knowledge?: KnowledgeEntry[];
  handover: HandoverRules;
  /** optional override of the template persona */
  persona?: { systemPrompt: string; language?: string };

  catalog: ClientCatalogItem[];
}

export type { Flow };
