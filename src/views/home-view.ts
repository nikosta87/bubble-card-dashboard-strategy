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
import {
  entityToCard,
  getEntityPresentation,
  groupRoomEntities,
  type EntityPresentation,
} from "../cards/entity-cards";
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
          ...overviewCards,
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

/**
 * Home is a glanceable surface, not a control catalogue. Rich overview cards
 * therefore use the full available width and only appear when they are useful.
 */
function buildOverviewCards(hass: HomeAssistant, options: StrategyConfig): LovelaceCard[] {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const candidateMediaPlayer = findLastUsedMediaPlayer(hass);
  const mediaPlayer = candidateMediaPlayer && ["playing", "paused"].includes(hass.states[candidateMediaPlayer]?.state)
    ? candidateMediaPlayer
    : undefined;
  const activeVacuum = findStateEntities(hass, ["vacuum"]).find((entity) => {
    const state = hass.states[entity]?.state;
    return state && !["docked", "idle", "off", "unavailable", "unknown"].includes(state);
  });

  return [
    ...(weather ? [{ type: "weather-forecast", entity: weather, forecast_type: "daily" }] : []),
    ...(mediaPlayer ? [mediaPlayerToCard(mediaPlayer, options)] : []),
    ...(activeVacuum
      ? [{
          type: "custom:bubble-card",
          card_type: "button",
          button_type: "state",
          entity: activeVacuum,
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
                  { entity: activeVacuum, icon: "mdi:play", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.start", target: { entity_id: activeVacuum } } },
                  { entity: activeVacuum, icon: "mdi:pause", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.pause", target: { entity_id: activeVacuum } } },
                  { entity: activeVacuum, icon: "mdi:home-map-marker", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.return_to_base", target: { entity_id: activeVacuum } } },
                ],
              },
            ],
          },
        }]
      : []),
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
    cards.push(...buildResponsiveEntityGrids(group.entities, options, hass));
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

/**
 * Keep entities in their existing order while switching between one-column
 * rich controls and two-column compact actions. Consecutive cards with the
 * same presentation are grouped into a grid, avoiding a one-size-fits-all
 * domain layout.
 */
function buildResponsiveEntityGrids(
  entities: HassEntity[],
  options: StrategyConfig,
  hass: HomeAssistant,
): LovelaceCard[] {
  const runs: Array<{ presentation: EntityPresentation; cards: LovelaceCard[] }> = [];

  entities.forEach((entity) => {
    const presentation = getEntityPresentation(entity, options, hass);
    const card = entityToCard(entity, options, hass);
    const current = runs[runs.length - 1];

    if (current?.presentation === presentation) {
      current.cards.push(card);
    } else {
      runs.push({ presentation, cards: [card] });
    }
  });

  return runs.map((run) => ({
    type: "grid",
    square: false,
    columns: run.presentation === "wide" ? 1 : 2,
    cards: run.cards,
  }));
}
