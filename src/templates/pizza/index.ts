import type { TemplateConfig } from "../../config/types";

// Pizza template — the reusable part shared by every pizza-shop client.
// Defines supported flows, required fields, default prompts, capabilities, and
// the standard "size" option group. Contains no client menu, prices, or branding.
export const pizzaTemplate: TemplateConfig = {
  templateId: "pizza",
  businessType: "pizza_shop",
  capabilities: ["ordering", "faq", "handover"],

  persona: {
    systemPrompt:
      "You are the ordering assistant for a pizza shop. Only offer items from the catalog, " +
      "never invent prices or products, ask for any missing details, and submit completed orders for approval.",
    language: "en",
  },

  // Reusable option groups a client's items reference by name.
  optionGroups: {
    size: {
      name: "size",
      required: true,
      prompt: "What size? (Small, Medium, Large)",
      options: [
        { name: "Small", priceDelta: 0 },
        { name: "Medium", priceDelta: 300 },
        { name: "Large", priceDelta: 600 },
      ],
    },
  },

  flows: [
    {
      id: "create_order",
      action: "create_order",
      usesCatalog: true,
      itemPrompt: "What would you like to order?",
      triggers: ["order", "buy", "get"],
      quantity: { required: true, prompt: "How many would you like?" },
      fields: [
        { name: "name", prompt: "Almost done — what name should I put the order under?", required: true },
      ],
      completionReply:
        "Thanks, {name}! Here's your order — sending it to {business} for approval:\n\n{summary}",
    },
  ],
};
