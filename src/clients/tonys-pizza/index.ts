import type { ClientConfig } from "../../config/types";

// Tony's Pizza — a client of the "pizza" template. Only client data lives here:
// menu, prices, branding, hours, delivery zones, staff, phones, knowledge.
// Prices are in minor units (US cents). Items reference the template's "size" group.
export const tonysPizza: ClientConfig = {
  clientId: "tonys-pizza",
  templateId: "pizza",

  name: "Tony's Pizza",
  currency: "USD",
  timezone: "America/New_York",
  locale: "en",

  branding: { logo: "" },
  phones: ["+15551234567"],
  deliveryZones: ["Downtown", "Riverside", "Uptown (5km radius)"],

  hours: [
    { day: 0, open: "12:00", close: "22:00" },
    { day: 1, closed: true, open: "", close: "" },
    { day: 2, open: "11:00", close: "22:00" },
    { day: 3, open: "11:00", close: "22:00" },
    { day: 4, open: "11:00", close: "22:00" },
    { day: 5, open: "11:00", close: "23:00" },
    { day: 6, open: "11:00", close: "23:00" },
  ],

  staff: [
    { fullName: "Shop Owner", email: "owner@tonys.local", role: "owner", password: "changeme123" },
  ],

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

  catalog: [
    {
      name: "Margherita",
      price: 1000,
      optionGroupRefs: ["size"],
      addOns: [
        { name: "Extra cheese", priceDelta: 150 },
        { name: "Mushrooms", priceDelta: 100 },
        { name: "Pepperoni", priceDelta: 200 },
      ],
    },
    {
      name: "Pepperoni",
      price: 1200,
      optionGroupRefs: ["size"],
      addOns: [
        { name: "Extra cheese", priceDelta: 150 },
        { name: "Jalapeños", priceDelta: 100 },
      ],
    },
    { name: "Garlic Bread", price: 500 },
    { name: "Cola 330ml", price: 250 },
  ],
};
