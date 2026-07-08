import { z } from "zod";
import { businessConfig } from "../config";
import type { Tool } from "./types";

const inputSchema = z.object({ query: z.string().min(1) });
type Input = z.infer<typeof inputSchema>;

// Thin keyword search over every flow's catalog (src/flow/types.ts CatalogItem).
// Read-only; no reimplementation of the flow engine's pricing rules.
export const searchProductsTool: Tool<Input> = {
  name: "search_products",
  description: "Search the business's product/service catalog by name and return price, options, and add-ons.",
  category: "catalog",
  inputSchema,
  async execute(input) {
    const q = input.query.toLowerCase();
    return businessConfig.flows
      .flatMap((f) => f.catalog ?? [])
      .filter((item) => item.name.toLowerCase().includes(q))
      .map((item) => ({
        name: item.name,
        price: item.price,
        optionGroups: item.optionGroups ?? [],
        addOns: item.addOns ?? [],
      }));
  },
};
