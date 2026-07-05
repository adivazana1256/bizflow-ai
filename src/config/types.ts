// Reusable client-automation config contract. One BusinessConfig specializes a
// deployment for a single client. See docs/CLIENT_ENGINE_SPEC.md.

export type FlowName = "order" | "appointment" | "lead" | "quote" | "faq" | "handover";

export interface BusinessHour {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  /** "HH:MM" 24h, in the business timezone */
  open: string;
  close: string;
  closed?: boolean;
}

/** All money is in integer minor units (e.g. cents) of the business currency. */
export interface CatalogOption {
  name: string;
  priceDelta: number;
}

export interface CatalogProduct {
  name: string;
  description?: string;
  /** base price in minor units */
  price: number;
  category?: string;
  variants?: CatalogOption[];
  extras?: CatalogOption[];
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
  /** 0..1; below this the AI hands over when onLowConfidence is set */
  confidenceThreshold?: number;
  onRequest: boolean;
}

export interface BusinessConfig {
  name: string;
  businessType: string;
  currency: string; // ISO 4217, e.g. "USD"
  timezone: string; // IANA, e.g. "America/New_York"
  locale?: string; // e.g. "en", "he"

  hours: BusinessHour[];

  persona: {
    /** system prompt that defines how the AI speaks and what it may do */
    systemPrompt: string;
    language?: string;
  };

  /** which flows are active — drives which AI tools are loaded */
  enabledFlows: FlowName[];

  catalog?: {
    categories?: string[];
    products: CatalogProduct[];
  };

  knowledge?: KnowledgeEntry[];

  handover: HandoverRules;

  /** panel logins created by the seed script */
  staff: StaffSeed[];
}
