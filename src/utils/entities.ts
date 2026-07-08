import {
  DEFAULT_IGNORED_DOMAINS,
  DEFAULT_ROOM_ORDER,
  DOMAIN_CARD_TYPES,
} from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HassStateObject,
  HomeAssistant,
  RoomOrder,
  StrategyConfig,
} from "../types";
import { slugify } from "./format";

export function getDomain(entityId: string): string {
  return entityId.split(".", 1)[0] || "";
}

/** Areas that have at least one entity assigned (directly or via a device). */
export function getActiveAreas(areas: HassArea[], entities: HassEntity[], devices: HassDevice[]): HassArea[] {
  return areas.filter((area) => entities.some((entity) => entityBelongsToArea(entity, area.area_id, devices)));
}

/** Sorts areas by the chosen order without applying any visibility filter. */
export function sortAreas(areas: HassArea[], order: RoomOrder, customOrder: string[]): HassArea[] {
  if (order === "alphabetical") {
    return [...areas].sort((left, right) => left.name.localeCompare(right.name));
  }

  if (order === "custom") {
    const rank = (areaId: string) => {
      const index = customOrder.indexOf(areaId);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...areas].sort((left, right) => rank(left.area_id) - rank(right.area_id) || left.name.localeCompare(right.name));
  }

  // "home_assistant": keep the order the area registry returned.
  return [...areas];
}

/** Applies the configured visibility filter and ordering to a list of areas. */
export function orderAreas(areas: HassArea[], options: StrategyConfig): HassArea[] {
  const hidden = new Set(options.hidden_areas ?? []);
  const visible = areas.filter((area) => !hidden.has(area.area_id));

  return sortAreas(visible, options.room_order ?? DEFAULT_ROOM_ORDER, options.custom_room_order ?? []);
}

export function entityBelongsToArea(entity: HassEntity, areaId: string, devices: HassDevice[]): boolean {
  if (entity.area_id === areaId) {
    return true;
  }

  if (!entity.area_id && entity.device_id) {
    return devices.some((device) => device.id === entity.device_id && device.area_id === areaId && !device.disabled_by);
  }

  return false;
}

export function getAreaEntities(
  areaId: string,
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): HassEntity[] {
  const ignoredEntities = new Set(options.ignored_entities ?? []);
  const ignoredDomains = new Set([...(options.ignored_domains ?? []), ...DEFAULT_IGNORED_DOMAINS]);

  return entities
    .filter((entity) => entityBelongsToArea(entity, areaId, devices))
    .filter((entity) => entity.entity_id in hass.states)
    .filter((entity) => !entity.hidden_by && !entity.disabled_by)
    .filter((entity) => !ignoredEntities.has(entity.entity_id))
    .filter((entity) => !ignoredDomains.has(getDomain(entity.entity_id)))
    .filter((entity) => DOMAIN_CARD_TYPES[getDomain(entity.entity_id)])
    .sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
}

export function findPrimaryEntityForArea(
  areaId: string,
  entities: HassEntity[],
  devices: HassDevice[],
): HassEntity | undefined {
  return entities.find((entity) => {
    const domain = getDomain(entity.entity_id);
    return ["light", "switch", "climate", "cover"].includes(domain) && entityBelongsToArea(entity, areaId, devices);
  });
}

export function getFriendlyName(entity: HassEntity, hass: HomeAssistant): string {
  const state = hass.states[entity.entity_id];
  const friendlyName = state?.attributes.friendly_name;

  return String(friendlyName || entity.name || entity.original_name || entity.entity_id);
}

export function findStateEntities(hass: HomeAssistant, domains: string[]): string[] {
  return Object.keys(hass.states)
    .filter((entityId) => domains.includes(getDomain(entityId)))
    .sort();
}

export function findFirstStateEntity(hass: HomeAssistant, domains: string[]): string | undefined {
  return findStateEntities(hass, domains)[0];
}

export function findLastUsedMediaPlayer(hass: HomeAssistant): string | undefined {
  const mediaPlayers = findStateEntities(hass, ["media_player"]);

  return mediaPlayers
    .map((entityId) => ({
      entityId,
      score: getMediaPlayerScore(hass, entityId),
    }))
    .sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId))[0]?.entityId;
}

function getMediaPlayerScore(hass: HomeAssistant, entityId: string): number {
  const state = hass.states[entityId];

  if (!state) {
    return 0;
  }

  const stateRank: Record<string, number> = {
    playing: 4,
    paused: 3,
    idle: 2,
    standby: 1,
    on: 1,
  };
  const mediaMetadataBonus = hasMediaMetadata(state.attributes) ? 10_000_000_000_000 : 0;
  const stateBonus = (stateRank[state.state] || 0) * 100_000_000_000_000;
  const updatedAt = getMediaPlayerUpdatedAt(state);

  return stateBonus + mediaMetadataBonus + updatedAt;
}

function hasMediaMetadata(attributes: Record<string, unknown>): boolean {
  return Boolean(
    attributes.media_title ||
      attributes.media_artist ||
      attributes.media_album_name ||
      attributes.entity_picture ||
      attributes.app_name,
  );
}

function getMediaPlayerUpdatedAt(state: HassStateObject): number {
  const candidates = [
    state.attributes.media_position_updated_at,
    state.last_updated,
    state.last_changed,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const timestamp = Date.parse(candidate);

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

export function getSonosMediaPlayers(entities: HassEntity[], options: StrategyConfig): string[] {
  return [
    ...new Set([
      ...entities.filter(isSonosMediaPlayer).map((entity) => entity.entity_id),
      ...(options.sonos_entities || []).filter((entityId) => getDomain(entityId) === "media_player"),
    ]),
  ].sort();
}

function isSonosMediaPlayer(entity: HassEntity): boolean {
  return getDomain(entity.entity_id) === "media_player" && entity.platform === "sonos";
}

export function getUserInitial(hass: HomeAssistant): string {
  return (hass.user?.name || "?").trim().slice(0, 1).toUpperCase() || "?";
}

export function getRoomHash(area: HassArea): string {
  return `#room-${slugify(area.name || area.area_id)}`;
}
