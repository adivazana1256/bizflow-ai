import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

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

export type Business = typeof businesses.$inferSelect;
export type Account = typeof accounts.$inferSelect;
