import {
  DEFAULT_MAX_ENTITIES_PER_AREA,
  ROOMS_POPUP_HASH,
} from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  StrategyConfig,
} from "../types";
import { bubbleSeparator, buttonToHash, fixedHomeCard } from "../cards/common";
import { entityToCard, groupRoomEntities } from "../cards/entity-cards";
import { mediaPlayerToCard } from "../cards/media-player";
import { buildTopNavigation } from "../cards/navigation";
import {
  findFirstStateEntity,
  findLastUsedMediaPlayer,
  findPrimaryEntityForArea,
  findStateEntities,
  getAreaEntities,
  getRoomHash,
} from "../utils/entities";

export function buildHomeView(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[] = [],
) {
  return {
    type: "sections",
    max_columns: 2,
    sections: [
      {
        type: "grid",
        cards: [
          buildTopNavigation(hass, options),
          {
            type: "grid",
            square: false,
            columns: 2,
            cards: buildOverviewCards(entities, hass, options, sonosEntities),
          },
          buildRoomsPopup(areas, entities, devices),
          ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options, sonosEntities)),
        ],
      },
    ],
  };
}

function buildOverviewCards(
  entities: HassEntity[],
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
): LovelaceCard[] {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const mediaPlayer = findLastUsedMediaPlayer(hass);
  const climate = findFirstStateEntity(hass, ["climate"]);
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
    ...(mediaPlayer
      ? [
          fixedHomeCard(mediaPlayerToCard(mediaPlayer, options, sonosEntities)),
        ]
      : []),
    ...(climate
      ? [
          fixedHomeCard({
            type: "custom:bubble-card",
            card_type: "climate",
            entity: climate,
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
              action: "call-service",
              service: "vacuum.start",
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

function buildRoomsPopup(areas: HassArea[], entities: HassEntity[], devices: HassDevice[]): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: ROOMS_POPUP_HASH,
    name: "Choose a room",
    icon: "mdi:home",
    popup_mode: "centered",
    width_desktop: "680px",
    bg_opacity: "85",
    bg_blur: "12",
    close_by_clicking_outside: true,
    cards: [
      {
        type: "grid",
        square: false,
        columns: 2,
        cards: areas.map((area) => {
          const primaryEntity = findPrimaryEntityForArea(area.area_id, entities, devices);

          return buttonToHash(
            area.name,
            area.icon || "mdi:home-outline",
            getRoomHash(area),
            primaryEntity?.entity_id,
          );
        }),
      },
    ],
  };
}

function buildRoomPopup(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[] = [],
): LovelaceCard {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options).slice(
    0,
    options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA,
  );
  const groups = groupRoomEntities(areaEntities);
  const cards: LovelaceCard[] = [buttonToHash("Back to rooms", "mdi:arrow-left", ROOMS_POPUP_HASH)];

  groups.forEach((group) => {
    if (!group.entities.length) {
      return;
    }

    cards.push(bubbleSeparator(group.title, group.icon));
    cards.push({
      type: "grid",
      square: false,
      columns: group.columns,
      cards: group.entities.map((entity) => entityToCard(entity, options, sonosEntities)),
    });
  });

  if (cards.length === 1) {
    cards.push({
      type: "markdown",
      content: "No visible entities found for this area.",
    });
  }

  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: getRoomHash(area),
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    popup_mode: "centered",
    width_desktop: "680px",
    bg_opacity: "85",
    bg_blur: "12",
    show_previous_button: true,
    close_by_clicking_outside: true,
    cards,
  };
}
