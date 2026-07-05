import type { BusinessConfig, TemplateConfig, ClientConfig, ClientCatalogItem } from "./types";
import type { CatalogItem, Flow } from "../flow/types";

// Package Loader. Merges a Template (flow structure, prompts, capabilities) with
// a Client (menu, prices, branding, hours, staff, knowledge) into the single
// BusinessConfig the flow engine consumes. Templates + clients change; the
// engine does not.

function resolveCatalog(items: ClientCatalogItem[], template: TemplateConfig): CatalogItem[] {
  return items.map((it) => {
    const refGroups = (it.optionGroupRefs ?? []).map((ref) => {
      const g = template.optionGroups?.[ref];
      if (!g) {
        throw new Error(
          `Template '${template.templateId}' has no option group '${ref}' (item '${it.name}')`,
        );
      }
      return g;
    });
    const optionGroups = [...refGroups, ...(it.optionGroups ?? [])];
    return {
      name: it.name,
      price: it.price,
      addOns: it.addOns,
      ...(optionGroups.length ? { optionGroups } : {}),
    };
  });
}

export function loadBusinessConfig(template: TemplateConfig, client: ClientConfig): BusinessConfig {
  if (client.templateId !== template.templateId) {
    throw new Error(
      `Client '${client.clientId}' expects template '${client.templateId}', got '${template.templateId}'`,
    );
  }

  const catalog = resolveCatalog(client.catalog, template);

  // Inject the client's catalog into the flow(s) that declare usesCatalog.
  const flows: Flow[] = template.flows.map((tf) => {
    const { usesCatalog, ...rest } = tf;
    return usesCatalog ? ({ ...rest, catalog } as Flow) : (rest as Flow);
  });

  return {
    name: client.name,
    businessType: template.businessType,
    currency: client.currency,
    timezone: client.timezone,
    locale: client.locale,
    hours: client.hours,
    persona: client.persona ?? template.persona,
    flows,
    knowledge: client.knowledge,
    handover: client.handover,
    staff: client.staff,
    branding: client.branding,
    deliveryZones: client.deliveryZones,
    phones: client.phones,
  };
}
