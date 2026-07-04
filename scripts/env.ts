// Loaded first (before any db module) so process.env is populated before the
// db clients read DATABASE_URL / ADMIN_DATABASE_URL at import time.
import { config } from "dotenv";

config({ path: ".env.local" });
