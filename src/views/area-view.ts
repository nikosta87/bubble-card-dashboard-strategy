import { DEFAULT_MAX_ENTITIES_PER_AREA } from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  StrategyConfig,
} from "../types";
import { bubbleSeparator, buildFooter } from "../cards/common";
import { entityToCard } from "../cards/entity-cards";
import { getAreaEntities } from "../utils/entities";

export function buildAreaView(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
) {
  const cards = getAreaEntities(area.area_id, entities, devices, hass, options)
    .slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA)
    .map((entity) => entityToCard(entity, options));

  return {
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          bubbleSeparator(area.name, area.icon || "mdi:home-outline"),
          cards.length
            ? {
                type: "grid",
                square: false,
                columns: 2,
                cards,
              }
            : {
                type: "markdown",
                content: "No visible entities found for this area.",
              },
          buildFooter([]),
        ],
      },
    ],
  };
}
