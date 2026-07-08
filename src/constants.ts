import type { MediaPlayerCardType } from "./types";

export const STRATEGY_TYPE = "bubble-card-dashboard";
export const DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
export const VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
export const EDITOR_ELEMENT = "bubble-card-dashboard-strategy-editor";
export const VERSION = "0.14.0";

export const DEFAULT_MAX_ENTITIES_PER_AREA = 24;
export const DEFAULT_MEDIA_PLAYER_CARD: MediaPlayerCardType = "bubble-card";
export const DEFAULT_SHOW_CAMERA_BUTTON = true;
export const DEFAULT_ENABLE_SONOS_GROUPING = true;
export const ROOMS_POPUP_HASH = "#rooms";

export const DOMAIN_CARD_TYPES: Record<string, string> = {
  alarm_control_panel: "button",
  button: "button",
  climate: "climate",
  cover: "cover",
  fan: "button",
  humidifier: "button",
  input_boolean: "button",
  light: "button",
  lock: "button",
  media_player: "media-player",
  scene: "button",
  script: "button",
  select: "select",
  switch: "button",
  vacuum: "button",
};

export const DEFAULT_IGNORED_DOMAINS = new Set([
  "automation",
  "camera",
  "device_tracker",
  "event",
  "group",
  "person",
  "sun",
  "update",
  "zone",
]);
