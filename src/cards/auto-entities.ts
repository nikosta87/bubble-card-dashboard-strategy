import type { LovelaceCard } from "../types";

export type AutoEntitiesFilter = Record<string, unknown>;

/**
 * Builds a custom:auto-entities card that fills a Bubble Card grid dynamically
 * from live entity state. Unlike the statically generated grids, this updates on
 * its own as entities change state, and sorts its matches alphabetically.
 *
 * Requires the auto-entities frontend resource to be installed.
 */
export function autoEntitiesGrid(columns: number, include: AutoEntitiesFilter[]): LovelaceCard {
  return {
    type: "custom:auto-entities",
    card: {
      type: "grid",
      square: false,
      columns,
    },
    card_param: "cards",
    show_empty: false,
    filter: {
      include,
    },
    sort: {
      method: "friendly_name",
    },
  };
}
