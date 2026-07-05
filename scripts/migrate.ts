import "./env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { max: 1 });
const ddl = readFileSync(join(process.cwd(), "drizzle", "0000_init.sql"), "utf8");

await sql.unsafe(ddl);
await sql.end();

console.log("✓ migration applied (businesses, accounts)");
