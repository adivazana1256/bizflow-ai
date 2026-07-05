import type { BusinessConfig } from "./types";
import { pizzaConfig } from "./pizza";

// The active client config for this deployment. Point this at the client's
// config file (one deployment = one business).
export const businessConfig: BusinessConfig = pizzaConfig;

export type { BusinessConfig };
