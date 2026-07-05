import { phoneStoreTemplate } from "../templates/phone-store";
import { galaxyMobile } from "../clients/galaxy-mobile";
import { loadBusinessConfig } from "./loader";
import type { BusinessConfig } from "./types";

// The active deployment = one client merged with its template. Point this at the
// client this deployment serves.
//
// Pizza example: import { pizzaTemplate } from "../templates/pizza";
//                import { tonysPizza } from "../clients/tonys-pizza";
//                loadBusinessConfig(pizzaTemplate, tonysPizza)
export const businessConfig: BusinessConfig = loadBusinessConfig(phoneStoreTemplate, galaxyMobile);

export type { BusinessConfig };
