import { DEFAULT_MAX_ENTITIES_PER_AREA } from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  StrategyConfig,
} from "../types";
import { bubblePopup, bubbleSeparator, buildFooter } from "../cards/common";
import { mediaPlayerToCard } from "../cards/media-player";
import { entityToCard, groupRoomEntities } from "../cards/entity-cards";
import { buildTopNavigation } from "../cards/navigation";
import { buildSmartRoomCards } from "../cards/room-cards";
import { createTranslator, type Translator } from "../i18n";
import {
  findFirstStateEntity,
  findLastUsedMediaPlayer,
  findStateEntities,
  getAreaEntities,
  getRoomHash,
} from "../utils/entities";
import { buildSummaryNavigation, buildSummaryPopups, getActiveSummaries } from "./summaries";

export function buildHomeView(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
) {
  const t = createTranslator(hass);
  const activeSummaries = getActiveSummaries(areas, entities, devices, hass, options);
  const overviewCards = buildOverviewCards(hass, options);

  return {
    type: "sections",
    max_columns: 2,
    sections: [
      {
        type: "grid",
        cards: [
          buildTopNavigation(hass, options),
          ...(overviewCards.length
            ? [
                {
                  type: "grid",
                  square: false,
                  columns: 2,
                  cards: overviewCards,
                },
              ]
            : []),
          ...(activeSummaries.length ? [buildSummaryNavigation(activeSummaries, t)] : []),
          ...buildRoomsSection(areas, entities, devices, hass, options, t),
          ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options, t)),
          ...buildSummaryPopups(activeSummaries, hass, options, t),
          buildFooter(areas, t("rooms")),
        ],
      },
    ],
  };
}

function buildOverviewCards(hass: HomeAssistant, options: StrategyConfig): LovelaceCard[] {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const mediaPlayer = findLastUsedMediaPlayer(hass);
  const vacuums = findStateEntities(hass, ["vacuum"]).slice(0, 1);

  return [
    ...(weather ? [{ type: "weather-forecast", entity: weather, forecast_type: "daily" }] : []),
    ...(mediaPlayer ? [mediaPlayerToCard(mediaPlayer, options)] : []),
    ...vacuums.map((entity) => ({
      type: "custom:bubble-card",
      card_type: "button",
      button_type: "state",
      entity,
      show_state: true,
      card_layout: "large",
      rows: 2,
      button_action: { tap_action: { action: "more-info" } },
      sub_button: {
        main: [],
        bottom: [
          {
            buttons_layout: "inline",
            justify_content: "fill",
            group: [
              { entity, icon: "mdi:play", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.start", target: { entity_id: entity } } },
              { entity, icon: "mdi:pause", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.pause", target: { entity_id: entity } } },
              { entity, icon: "mdi:home-map-marker", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.return_to_base", target: { entity_id: entity } } },
            ],
          },
        ],
      },
    })),
  ];
}

function buildRoomsSection(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
  t: Translator,
): LovelaceCard[] {
  return [
    bubbleSeparator(t("rooms"), "mdi:floor-plan"),
    {
      type: "grid",
      square: false,
      columns: 2,
      cards: buildSmartRoomCards(areas, entities, devices, hass, options),
    },
  ];
}

function buildRoomPopup(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
  t: Translator,
): LovelaceCard {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options);
  const maxEntities = options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
  let remainingEntities = maxEntities;
  const groups = groupRoomEntities(areaEntities).map((group) => {
    const visibleEntities = group.entities.slice(0, remainingEntities);
    remainingEntities -= visibleEntities.length;
    return { ...group, entities: visibleEntities };
  });
  const cards: LovelaceCard[] = [];

  groups.forEach((group) => {
    if (!group.entities.length) return;

    cards.push(bubbleSeparator(t(group.titleKey), group.icon));
    cards.push({
      type: "grid",
      square: false,
      columns: group.columns,
      cards: group.entities.map((entity) => entityToCard(entity, options, hass)),
    });
  });

  if (!cards.length) {
    cards.push({ type: "markdown", content: t("noEntities") });
  }

  return bubblePopup({
    hash: getRoomHash(area),
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    cards,
  });
}
