import type { RoomOrder, ThemeGrouping } from "./types";

export const STRATEGY_TYPE = "bubble-card-dashboard";
export const DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
export const VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
export const EDITOR_ELEMENT = "bubble-card-dashboard-strategy-editor";
export const VERSION = "0.22.1";

export const DEFAULT_MAX_ENTITIES_PER_AREA = 24;
export const DEFAULT_ENABLE_ADVANCED_CONTROLS = true;
export const DEFAULT_THEME_GROUPING: ThemeGrouping = "state";
export const DEFAULT_ROOM_ORDER: RoomOrder = "alphabetical";
export const DEFAULT_HIDE_MOBILE_APP_BATTERIES = true;
export const DEFAULT_BATTERY_CRITICAL_BELOW = 20;
export const DEFAULT_BATTERY_LOW_BELOW = 40;
export const DEFAULT_SHOW_ALARM_CONTROLS = true;
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
  number: "button",
  scene: "button",
  script: "button",
  select: "select",
  input_number: "button",
  input_select: "select",
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
