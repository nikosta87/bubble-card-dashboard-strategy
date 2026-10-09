import { DEFAULT_MAX_ENTITIES_PER_AREA } from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  StrategyConfig,
} from "../types";
import { bubbleSeparator, buildFooter } from "../cards/common";
import { entityToCard, getEntityPresentation, groupRoomEntities } from "../cards/entity-cards";
import { getAreaEntities } from "../utils/entities";
import { createTranslator } from "../i18n";

export function buildAreaView(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
) {
  const roomEntities = getAreaEntities(area.area_id, entities, devices, hass, options)
    .slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA);
  const t = createTranslator(hass);
  const cards = groupRoomEntities(roomEntities).flatMap((group) => {
    if (!group.entities.length) return [];
    const wide = group.entities.filter((entity) => getEntityPresentation(entity, options, hass) === "wide");
    const compact = group.entities.filter((entity) => getEntityPresentation(entity, options, hass) !== "wide");
    return [bubbleSeparator(t(group.titleKey), group.icon),
      ...(wide.length ? [{ type: "grid", square: false, columns: 1, cards: wide.map((entity) => entityToCard(entity, options, hass)) }] : []),
      ...(compact.length ? [{ type: "grid", square: false, columns: 2, cards: compact.map((entity) => entityToCard(entity, options, hass)) }] : [])];
  });

  return {
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          bubbleSeparator(area.name, area.icon || "mdi:home-outline"),
          cards.length
            ? { type: "vertical-stack", cards }
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
