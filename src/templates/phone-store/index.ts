import type { TemplateConfig } from "../../config/types";

// Phone-store template — the reusable part shared by every phone-store client.
// Supported capabilities: product availability + FAQ (via knowledge), repair
// booking (the slot-filling flow), handover (generic). No client products,
// prices, or branding here.
export const phoneStoreTemplate: TemplateConfig = {
  templateId: "phone-store",
  businessType: "phone_store",
  capabilities: ["product_availability", "repair_booking", "lead_capture", "faq", "handover"],

  persona: {
    systemPrompt:
      "You are the assistant for a phone store. Answer product availability and FAQ questions " +
      "from the provided knowledge, help customers book repairs, and hand over to a human when asked. " +
      "Never invent prices or stock.",
    language: "en",
  },

  // Two slot-filling flows selected by intent: repair booking (uses the client's
  // service catalog) and lead capture (no catalog — pure field collection).
  flows: [
    {
      id: "book_repair",
      action: "book_repair",
      usesCatalog: true,
      itemPrompt:
        "Which repair do you need? (Screen replacement, Battery replacement, Water damage diagnostics)",
      triggers: ["repair", "fix", "broken", "cracked", "replace", "not working"],
      fields: [
        { name: "device", prompt: "Which phone model needs the repair?", required: true },
        { name: "name", prompt: "What name is the booking under?", required: true },
        { name: "phone", prompt: "What's the best phone number to reach you?", required: true },
      ],
      completionReply:
        "Thanks, {name}! Your {item} booking for your {device} is sent to {business}. We'll confirm at {phone}.",
    },
    {
      id: "lead_capture",
      action: "create_lead",
      triggers: ["buy", "purchase", "interested", "looking for", "reserve", "quote", "trade in"],
      fields: [
        { name: "name", prompt: "Sure! Can I take your name?", required: true },
        { name: "phone", prompt: "And the best phone number to reach you?", required: true },
        { name: "interest", prompt: "Which phone are you interested in?", required: true },
      ],
      completionReply:
        "Thanks, {name}! Someone from {business} will contact you at {phone} about the {interest}.",
    },
  ],
};
