import { bubbleRoomAmbientStyles } from "../design";
import type { HassArea, HassDevice, HassEntity, HomeAssistant, LovelaceCard, StrategyConfig } from "../types";
import { getDomain, getRoomHash, getVisibleAreaEntities } from "../utils/entities";

export function buildSmartRoomCards(
  areas: HassArea[], entities: HassEntity[], devices: HassDevice[], hass: HomeAssistant, options: StrategyConfig,
): LovelaceCard[] {
  return areas.map((area) => smartRoomCard(area, entities, devices, hass, options));
}

function smartRoomCard(
  area: HassArea, entities: HassEntity[], devices: HassDevice[], hass: HomeAssistant, options: StrategyConfig,
): LovelaceCard {
  const areaEntities = getVisibleAreaEntities(area.area_id, entities, devices, hass, options);
  const lightIds = areaEntities.filter((entity) => getDomain(entity.entity_id) === "light").map((entity) => entity.entity_id);
  const statusEntities = findRoomStatusEntities(areaEntities, hass);
  const ambient = options.ambient_room_colors ?? true;
  const intensity = options.visual_intensity ?? "balanced";

  // Room tiles are navigation surfaces, not miniature device cards. They remain
  // stable when the first entity in an area changes and expose only two useful
  // facts. Device interaction belongs in the room popup.
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    ...(ambient && lightIds.length ? { styles: bubbleRoomAmbientStyles(lightIds, intensity) } : {}),
    card_layout: "large",
    rows: 2,
    show_name: true,
    show_state: false,
    button_action: { tap_action: { action: "navigate", navigation_path: getRoomHash(area) } },
    ...(statusEntities.length ? {
      sub_button: {
        main: [],
        bottom: [{ buttons_layout: "inline", justify_content: "start", group: statusEntities.map(roomStatusSubButton) }],
      },
    } : {}),
  };
}

function findRoomStatusEntities(entities: HassEntity[], hass: HomeAssistant): HassEntity[] {
  const findByDeviceClass = (domain: string, deviceClasses: string[]) => entities.find((entity) => {
    const state = hass.states[entity.entity_id];
    return getDomain(entity.entity_id) === domain && deviceClasses.includes(String(state?.attributes.device_class || ""));
  });
  const lights = entities.filter((entity) => getDomain(entity.entity_id) === "light");
  const candidates = [
    findByDeviceClass("sensor", ["temperature"]),
    findByDeviceClass("binary_sensor", ["door", "window", "opening"]),
    findByDeviceClass("binary_sensor", ["occupancy", "presence", "motion"]),
    lights[0],
  ];
  return candidates.filter((entity): entity is HassEntity => Boolean(entity)).slice(0, 2);
}

function roomStatusSubButton(entity: HassEntity): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  return {
    entity: entity.entity_id,
    show_state: domain === "sensor" || domain === "binary_sensor",
    show_name: false,
    show_background: true,
    state_background: domain !== "sensor",
    light_background: domain === "light",
    fill_width: false,
    tap_action: { action: domain === "light" ? "toggle" : "more-info" },
  };
}
