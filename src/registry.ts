import type { HassArea, HassDevice, HassEntity, HomeAssistant } from "./types";

export type Registries = {
  areas: HassArea[];
  devices: HassDevice[];
  entities: HassEntity[];
};

// Home Assistant re-runs a strategy on many hass updates. Without caching, every
// generation (and every future theme view) would re-request all three registries
// over the websocket. The registries change rarely, so we serve them from a short
// in-memory cache and only refetch after the TTL expires or a registry actually
// changes.
const CACHE_TTL_MS = 30_000;

const REGISTRY_EVENTS = [
  "area_registry_updated",
  "device_registry_updated",
  "entity_registry_updated",
];

type CacheEntry = {
  timestamp: number;
  promise: Promise<Registries>;
};

let cache: CacheEntry | null = null;
let subscribed = false;

/**
 * Returns the area, device and entity registries, served from an in-memory cache
 * when a recent copy exists. Concurrent callers share a single in-flight request,
 * so a dashboard and all of its views only trigger one websocket round-trip.
 */
export async function getRegistries(
  hass: HomeAssistant,
  options: { force?: boolean } = {},
): Promise<Registries> {
  ensureInvalidationSubscription(hass);

  const now = Date.now();

  if (!options.force && cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.promise;
  }

  const promise = loadRegistries(hass);
  const entry: CacheEntry = { timestamp: now, promise };
  cache = entry;

  try {
    return await promise;
  } catch (error) {
    // Never cache a failed request; the next call should retry from scratch.
    if (cache === entry) {
      cache = null;
    }
    throw error;
  }
}

/** Drops the cached registries so the next call fetches a fresh copy. */
export function invalidateRegistries(): void {
  cache = null;
}

async function loadRegistries(hass: HomeAssistant): Promise<Registries> {
  const [areas, devices, entities] = await Promise.all([
    hass.callWS<HassArea[]>({ type: "config/area_registry/list" }),
    hass.callWS<HassDevice[]>({ type: "config/device_registry/list" }),
    hass.callWS<HassEntity[]>({ type: "config/entity_registry/list" }),
  ]);

  return { areas, devices, entities };
}

// Best-effort: when the registries change in Home Assistant we drop the cache so
// new areas or devices show up immediately instead of after the TTL. Degrades
// gracefully when the connection API is unavailable.
function ensureInvalidationSubscription(hass: HomeAssistant): void {
  if (subscribed || !hass.connection?.subscribeEvents) {
    return;
  }

  subscribed = true;

  for (const eventType of REGISTRY_EVENTS) {
    hass.connection.subscribeEvents(() => invalidateRegistries(), eventType).catch(() => {
      // Ignore subscription errors; the TTL still keeps the cache fresh enough.
    });
  }
}
