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

export type Business = typeof businesses.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
