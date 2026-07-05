import type { ClientConfig } from "../../config/types";

// Galaxy Mobile — a client of the "phone-store" template. Only client data:
// products (as knowledge for availability), repair-service prices, hours,
// staff, branding, knowledge. Prices in minor units (US cents).
export const galaxyMobile: ClientConfig = {
  clientId: "galaxy-mobile",
  templateId: "phone-store",

  name: "Galaxy Mobile",
  currency: "USD",
  timezone: "America/Los_Angeles",
  locale: "en",

  branding: { logo: "" },
  phones: ["+15559876543"],

  hours: [
    { day: 0, closed: true, open: "", close: "" }, // Sun closed
    { day: 1, open: "10:00", close: "19:00" },
    { day: 2, open: "10:00", close: "19:00" },
    { day: 3, open: "10:00", close: "19:00" },
    { day: 4, open: "10:00", close: "19:00" },
    { day: 5, open: "10:00", close: "19:00" },
    { day: 6, open: "10:00", close: "19:00" },
  ],

  staff: [
    { fullName: "Store Manager", email: "owner@galaxymobile.local", role: "owner", password: "changeme123" },
  ],

  knowledge: [
    // Product availability
    {
      title: "iPhone 16 Pro",
      content: "iPhone 16 Pro — in stock. $999. 256GB, Titanium. Includes 1-year Apple warranty.",
      category: "Products",
    },
    {
      title: "Samsung Galaxy S26",
      content: "Samsung Galaxy S26 — in stock. $899. 256GB. Includes 1-year manufacturer warranty.",
      category: "Products",
    },
    {
      title: "Google Pixel 10",
      content: "Google Pixel 10 — limited stock. $799. 128GB. Includes 1-year manufacturer warranty.",
      category: "Products",
    },
    // FAQ
    {
      title: "Warranty",
      content:
        "New phones include a 1-year manufacturer warranty. Repairs we perform are guaranteed for 90 days.",
      category: "Warranty",
    },
    {
      title: "Repair times",
      content:
        "Screen and battery replacements are usually same-day (1–2 hours). Water damage diagnostics take 24–48 hours.",
      category: "Repairs",
    },
    {
      title: "Store hours",
      content: "We are open Monday–Saturday 10:00–19:00, and closed on Sunday.",
      category: "Hours",
    },
  ],

  handover: {
    onComplaint: true,
    onLowConfidence: true,
    confidenceThreshold: 0.5,
    onRequest: true,
  },

  // Repair services (priced, minor units). The slot-filling flow's catalog.
  catalog: [
    { name: "Screen replacement", price: 12900 },
    { name: "Battery replacement", price: 6900 },
    { name: "Water damage diagnostics", price: 3900 },
  ],
};
