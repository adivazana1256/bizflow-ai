import type { BusinessConfig } from "./types";

// Example client config: a pizza shop. WhatsApp ordering + business approval.
// Prices are in minor units (US cents). Duplicate this file per client and swap
// the values — no engine code changes.
export const pizzaConfig: BusinessConfig = {
  name: "Tony's Pizza",
  businessType: "pizza_shop",
  currency: "USD",
  timezone: "America/New_York",
  locale: "en",

  hours: [
    { day: 0, open: "12:00", close: "22:00" }, // Sun
    { day: 1, closed: true, open: "", close: "" }, // Mon closed
    { day: 2, open: "11:00", close: "22:00" },
    { day: 3, open: "11:00", close: "22:00" },
    { day: 4, open: "11:00", close: "22:00" },
    { day: 5, open: "11:00", close: "23:00" },
    { day: 6, open: "11:00", close: "23:00" },
  ],

  persona: {
    systemPrompt:
      "You are the ordering assistant for Tony's Pizza. Take orders over WhatsApp. " +
      "Only offer items from the catalog and never invent prices or products. Ask for any " +
      "missing details (size, extras, quantity, customer name). When the order is complete, " +
      "confirm it and submit it for the shop to approve. Be friendly and brief.",
    language: "en",
  },

  enabledFlows: ["order", "faq", "handover"],

  catalog: {
    categories: ["Pizzas", "Sides", "Drinks"],
    products: [
      {
        name: "Margherita",
        description: "Tomato, mozzarella, basil.",
        price: 1000,
        category: "Pizzas",
        variants: [
          { name: "Small", priceDelta: 0 },
          { name: "Medium", priceDelta: 300 },
          { name: "Large", priceDelta: 600 },
        ],
        extras: [
          { name: "Extra cheese", priceDelta: 150 },
          { name: "Mushrooms", priceDelta: 100 },
          { name: "Pepperoni", priceDelta: 200 },
        ],
      },
      {
        name: "Pepperoni",
        description: "Tomato, mozzarella, pepperoni.",
        price: 1200,
        category: "Pizzas",
        variants: [
          { name: "Small", priceDelta: 0 },
          { name: "Medium", priceDelta: 300 },
          { name: "Large", priceDelta: 600 },
        ],
        extras: [
          { name: "Extra cheese", priceDelta: 150 },
          { name: "Jalapeños", priceDelta: 100 },
        ],
      },
      { name: "Garlic Bread", price: 500, category: "Sides" },
      { name: "Cola 330ml", price: 250, category: "Drinks" },
    ],
  },

  knowledge: [
    {
      title: "Delivery area",
      content: "We deliver within 5 km of the shop. Delivery is free over $20, otherwise $3.",
      category: "Delivery",
    },
    {
      title: "Payment",
      content: "We accept cash on delivery and card in store. Online payment is not available yet.",
      category: "Payment",
    },
  ],

  handover: {
    onComplaint: true,
    onLowConfidence: true,
    confidenceThreshold: 0.5,
    onRequest: true,
  },

  staff: [
    { fullName: "Shop Owner", email: "owner@tonys.local", role: "owner", password: "changeme123" },
  ],
};
