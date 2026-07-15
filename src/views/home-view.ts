import { DEFAULT_MAX_ENTITIES_PER_AREA, DEFAULT_SUMMARY_COLUMNS } from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  StrategyConfig,
} from "../types";
import { bubblePopup, bubbleSeparator, fixedHomeCard } from "../cards/common";
import { buildCamerasPopup } from "../cards/cameras";
import { entityToCard, groupRoomEntities } from "../cards/entity-cards";
import { buildTopNavigation } from "../cards/navigation";
import { buildSmartRoomCards } from "../cards/room-cards";
import { createTranslator, type Translator } from "../i18n";
import {
  findFirstStateEntity,
  findStateEntities,
  getCameraEntities,
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
  sonosEntities: string[] = [],
) {
  const t = createTranslator(hass);
  const activeSummaries = getActiveSummaries(areas, entities, devices, hass, options);
  const summaryColumns = options.summary_columns ?? DEFAULT_SUMMARY_COLUMNS;
  const overviewCards = buildOverviewCards(hass);
  const cameras = getCameraEntities(entities, hass, options);

  return {
    type: "sections",
    max_columns: 2,
    sections: [
      {
        type: "grid",
        cards: [
          buildTopNavigation(hass, options, cameras.length > 0),
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
          ...(activeSummaries.length ? [buildSummaryNavigation(activeSummaries, summaryColumns, options, t)] : []),
          ...buildRoomsSection(areas, entities, devices, hass, options, t),
          ...(cameras.length ? [buildCamerasPopup(cameras, hass, options, t("cameras"))] : []),
          ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options, sonosEntities, t)),
          ...buildSummaryPopups(activeSummaries, hass, options, sonosEntities, t),
        ],
      },
    ],
  };
}

function buildOverviewCards(hass: HomeAssistant): LovelaceCard[] {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const vacuums = findStateEntities(hass, ["vacuum"]).slice(0, 2);

  return [
    ...(weather
      ? [
          fixedHomeCard({
            type: "weather-forecast",
            entity: weather,
            forecast_type: "daily",
          }),
        ]
      : []),
    ...vacuums.map((entity) =>
      fixedHomeCard({
        type: "custom:bubble-card",
        card_type: "button",
        button_type: "state",
        entity,
        sub_button: [
          {
            entity,
            icon: "mdi:play",
            tap_action: {
              action: "perform-action",
              perform_action: "vacuum.start",
              target: {
                entity_id: entity,
              },
            },
          },
        ],
      }),
    ),
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
  sonosEntities: string[] = [],
  t: Translator,
): LovelaceCard {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options).slice(
    0,
    options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA,
  );
  const groups = groupRoomEntities(areaEntities);
  const cards: LovelaceCard[] = [];

  groups.forEach((group) => {
    if (!group.entities.length) {
      return;
    }

    cards.push(bubbleSeparator(t(group.titleKey), group.icon));
    cards.push({
      type: "grid",
      square: false,
      columns: group.columns,
      cards: group.entities.map((entity) => entityToCard(entity, options, sonosEntities)),
    });
  });

  if (!cards.length) {
    cards.push({
      type: "markdown",
      content: t("noEntities"),
    });
  }

  return bubblePopup({
    hash: getRoomHash(area),
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    cards,
  });
}
