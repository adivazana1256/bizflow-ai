import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

// Business — the tenant root. Fields per docs/MASTER_PRD.md.
export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  businessType: text("business_type"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  logo: text("logo"),
  timezone: text("timezone").notNull().default("UTC"),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Account — a person who can log in. Owner or staff. (C1)
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("staff"), // owner | staff
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Customer — a person who placed an order. Created from the order summary.
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Order — created pending, awaiting staff approval. Money in minor units.
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  customerId: uuid("customer_id").references(() => customers.id),
  total: integer("total").notNull(), // minor units
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  // dedup key derived from the summary, so a repeated identical chat result
  // does not create duplicate orders. Unique per business.
  sourceKey: text("source_key"),
  // Source channel ("whatsapp" | "simulator") + the customer's id on that
  // channel (WhatsApp wa_id), so approval replies know where to send.
  channel: text("channel"),
  customerExternalId: text("customer_external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  productName: text("product_name").notNull(),
  variantName: text("variant_name"),
  extras: text("extras"), // comma-joined names
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(), // minor units
  lineTotal: integer("line_total").notNull(), // minor units
});

// Lead — captured contact from the lead_capture flow. Follow-up list.
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  name: text("name").notNull(),
  phone: text("phone"),
  interest: text("interest"),
  status: text("status").notNull().default("new"), // new | contacted
  sourceKey: text("source_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Repair booking — from the book_repair flow. Awaits staff confirmation.
export const repairBookings = pgTable("repair_bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  service: text("service").notNull(),
  device: text("device"),
  name: text("name").notNull(),
  phone: text("phone"),
  price: integer("price").notNull().default(0), // minor units
  currency: text("currency").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  sourceKey: text("source_key"),
  // Source channel ("whatsapp" | "simulator") + the customer's id on that
  // channel (WhatsApp wa_id), so approval replies know where to send.
  channel: text("channel"),
  customerExternalId: text("customer_external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Conversation — one thread per (business, channel, external id e.g. WhatsApp
// wa_id). The Conversation Manager (src/server/conversations.ts) owns this.
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  channel: text("channel").notNull(), // "whatsapp" | ...
  externalId: text("external_id").notNull(), // provider user id (e.g. wa_id/phone)
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Message — one row per turn. channelMessageId (provider wamid) is the
// idempotency key: a re-delivered webhook maps to the same id and is skipped.
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id),
  role: text("role").notNull(), // "user" | "assistant"
  text: text("text").notNull(),
  channelMessageId: text("channel_message_id"), // provider wamid, null for simulator
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Business = typeof businesses.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type RepairBooking = typeof repairBookings.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
