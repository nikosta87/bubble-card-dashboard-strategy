import type { HassArea, HassDevice, HassEntity, HomeAssistant, LovelaceCard, StrategyConfig } from "../types";
import { getDomain, getRoomHash, getVisibleAreaEntities } from "../utils/entities";

export function buildSmartRoomCards(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): LovelaceCard[] {
  return areas.map((area) => smartRoomCard(area, entities, devices, hass, options));
}

function smartRoomCard(
  area: HassArea,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): LovelaceCard {
  const areaEntities = getVisibleAreaEntities(area.area_id, entities, devices, hass, options);
  const primaryEntity = findRoomPrimaryEntity(areaEntities);
  const statusEntities = findRoomStatusEntities(areaEntities, hass).filter(
    (entity) => entity.entity_id !== primaryEntity?.entity_id,
  );
  const primaryDomain = primaryEntity ? getDomain(primaryEntity.entity_id) : "";

  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: primaryEntity ? (["light", "switch"].includes(primaryDomain) ? "switch" : "state") : "name",
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    ...(primaryEntity ? { entity: primaryEntity.entity_id } : {}),
    card_layout: "large",
    rows: 2,
    show_name: true,
    show_state: false,
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: getRoomHash(area),
      },
    },
    ...(statusEntities.length
      ? {
          sub_button: {
            main: [],
            bottom: [
              {
                buttons_layout: "inline",
                justify_content: "start",
                group: statusEntities.map(roomStatusSubButton),
              },
            ],
          },
        }
      : {}),
  };
}

function findRoomPrimaryEntity(entities: HassEntity[]): HassEntity | undefined {
  for (const domain of ["light", "switch", "climate", "cover"]) {
    const entity = entities.find((candidate) => getDomain(candidate.entity_id) === domain);
    if (entity) return entity;
  }
  return undefined;
}

function findRoomStatusEntities(entities: HassEntity[], hass: HomeAssistant): HassEntity[] {
  const findByDeviceClass = (domain: string, deviceClasses: string[]) =>
    entities.find((entity) => {
      const state = hass.states[entity.entity_id];
      return getDomain(entity.entity_id) === domain && deviceClasses.includes(String(state?.attributes.device_class || ""));
    });

  const candidates = [
    findByDeviceClass("sensor", ["temperature"]),
    findByDeviceClass("binary_sensor", ["occupancy", "presence", "motion"]),
    findByDeviceClass("binary_sensor", ["door", "window", "opening"]),
    entities.find((entity) => getDomain(entity.entity_id) === "light"),
  ];

  return candidates.filter((entity): entity is HassEntity => Boolean(entity)).slice(0, 4);
}

function roomStatusSubButton(entity: HassEntity): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  return {
    entity: entity.entity_id,
    show_state: domain === "sensor" || domain === "binary_sensor",
    show_name: false,
    show_background: true,
    state_background: domain !== "sensor",
    fill_width: false,
    tap_action: {
      action: domain === "light" ? "toggle" : "more-info",
    },
  };
}
