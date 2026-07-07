import {
  DEFAULT_IGNORED_DOMAINS,
  DOMAIN_CARD_TYPES,
} from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HassStateObject,
  HomeAssistant,
  StrategyConfig,
} from "../types";
import { slugify } from "./format";

export function getDomain(entityId: string): string {
  return entityId.split(".", 1)[0] || "";
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
