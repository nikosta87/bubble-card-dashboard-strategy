export type HassEntity = {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  platform?: string | null;
  hidden_by?: string | null;
  disabled_by?: string | null;
  name?: string | null;
  original_name?: string | null;
};

export type HassDevice = {
  id: string;
  area_id?: string | null;
  disabled_by?: string | null;
};

export type HassArea = {
  area_id: string;
  name: string;
  icon?: string | null;
};

export type HassStateObject = {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed?: string;
  last_updated?: string;
};

export type HomeAssistant = {
  config: {
    location_name?: string;
  };
  user?: {
    name?: string;
  };
  states: Record<string, HassStateObject>;
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  connection?: {
    subscribeEvents(
      callback: (event: unknown) => void,
      eventType: string,
    ): Promise<() => void>;
  };
};

export type MediaPlayerCardType = "bubble-card" | "mini-media-player" | "yamp";

export type ThemeGrouping = "area" | "state" | "none";

export type RoomOrder = "home_assistant" | "alphabetical" | "custom";

export type SummaryColumns = 2 | 4;

export type StrategyConfig = {
  title?: string;
  profile_image?: string;
  ignored_entities?: string[];
  ignored_domains?: string[];
  max_entities_per_area?: number;
  media_player_card?: MediaPlayerCardType;
  show_camera_button?: boolean;
  enable_sonos_grouping?: boolean;
  sonos_entities?: string[];
  theme_grouping?: ThemeGrouping;
  room_order?: RoomOrder;
  hidden_areas?: string[];
  custom_room_order?: string[];
  summary_columns?: SummaryColumns;
  show_light_summary?: boolean;
  show_security_summary?: boolean;
  show_climate_summary?: boolean;
  show_battery_summary?: boolean;
  hide_mobile_app_batteries?: boolean;
  battery_critical_below?: number;
};

export type LovelaceCard = Record<string, unknown>;
