import { DEFAULT_ENABLE_ADVANCED_CONTROLS, DOMAIN_CARD_TYPES } from "../constants";
import { bubbleLightSurfaceStyles } from "../design";
import type { HassEntity, HomeAssistant, LovelaceCard, StrategyConfig } from "../types";
import type { TranslationKey } from "../i18n";
import { getDomain } from "../utils/entities";
import { mediaPlayerToCard } from "./media-player";

type RoomEntityGroup = {
  titleKey: TranslationKey;
  icon: string;
  domains: string[];
  entities: HassEntity[];
};

export type EntityPresentation = "compact" | "wide";

export function groupRoomEntities(entities: HassEntity[]): RoomEntityGroup[] {
  const groupDefinitions: Omit<RoomEntityGroup, "entities">[] = [
    { titleKey: "lights", icon: "mdi:lightbulb-group", domains: ["light"] },
    { titleKey: "climate", icon: "mdi:thermostat", domains: ["climate", "fan", "humidifier"] },
    { titleKey: "media", icon: "mdi:speaker", domains: ["media_player"] },
    { titleKey: "covers", icon: "mdi:window-shutter", domains: ["cover"] },
    { titleKey: "scenes", icon: "mdi:palette", domains: ["scene", "script", "button"] },
    { titleKey: "devices", icon: "mdi:power-plug", domains: ["alarm_control_panel", "input_boolean", "input_number", "input_select", "lock", "number", "select", "switch", "vacuum"] },
  ];

  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id))),
  }));
}

/**
 * Decide how much horizontal space an entity needs in a room popup. The choice
 * is based on interaction density rather than the section/domain alone, which
 * keeps simple actions compact while preserving readable controls for sliders,
 * media and other rich cards.
 */
export function getEntityPresentation(
  entity: HassEntity,
  options: StrategyConfig,
  hass?: HomeAssistant,
): EntityPresentation {
  const domain = getDomain(entity.entity_id);

  if (["media_player", "climate", "cover", "vacuum", "alarm_control_panel", "lock"].includes(domain)) {
    return "wide";
  }

  if (["select", "input_select"].includes(domain)) return "wide";

  if (["number", "input_number", "fan", "humidifier"].includes(domain)) {
    return useAdvancedControls(options) ? "wide" : "compact";
  }

  if (domain === "light") {
    if (!useAdvancedControls(options)) return "compact";
    const attributes = hass?.states[entity.entity_id]?.attributes ?? {};
    const colorModes = Array.isArray(attributes.supported_color_modes)
      ? attributes.supported_color_modes.map(String)
      : [];
    const hasRichLightControls =
      attributes.brightness !== undefined ||
      attributes.min_color_temp_kelvin !== undefined ||
      attributes.max_color_temp_kelvin !== undefined ||
      colorModes.some((mode) => mode !== "onoff");
    return hasRichLightControls || !hass ? "wide" : "compact";
  }

  return "compact";
}

/** auto-entities injects the matched entity into this template at runtime. */
export function entityCardTemplate(domain: string, options: StrategyConfig = {}): LovelaceCard {
  if (domain === "media_player") return { type: "custom:bubble-card", card_type: "media-player" };

  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    const useSlider = useAdvancedControls(options) && ["light", "fan", "number", "input_number"].includes(domain);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: useSlider ? "slider" : ["scene", "script", "button"].includes(domain) ? "name" : "switch",
      ...(domain === "light" ? { use_accent_color: false, styles: bubbleLightSurfaceStyles() } : {}),
      ...(useSlider ? { slider_value_position: "right" } : {}),
    };
  }

  return bubbleDomainCard(cardType, domain, undefined, options);
}

export function entityToCard(entity: HassEntity, options: StrategyConfig, hass?: HomeAssistant): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  if (domain === "media_player") return mediaPlayerToCard(entity.entity_id, options);
  if (domain === "light") return lightToCard(entity.entity_id, options, hass);
  return entityToBubbleCard(entity, options, hass);
}

function lightToCard(entityId: string, options: StrategyConfig, hass?: HomeAssistant): LovelaceCard {
  if (!useAdvancedControls(options)) {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: "switch",
      entity: entityId,
      use_accent_color: false,
      styles: bubbleLightSurfaceStyles(),
    };
  }

  const attributes = hass?.states[entityId]?.attributes ?? {};
  const colorModes = Array.isArray(attributes.supported_color_modes)
    ? attributes.supported_color_modes.map(String)
    : [];
  const supportsBrightness = attributes.brightness !== undefined || colorModes.some((mode) => mode !== "onoff");
  const supportsTemperature =
    attributes.min_color_temp_kelvin !== undefined ||
    attributes.max_color_temp_kelvin !== undefined ||
    colorModes.includes("color_temp");
  const supportsColor = colorModes.some((mode) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode));

  const controls: LovelaceCard[] = [];
  if (supportsBrightness || !hass) {
    controls.push({
      entity: entityId,
      sub_button_type: "slider",
      icon: "mdi:brightness-6",
      always_visible: true,
      show_background: false,
      light_background: true,
      hide_when_parent_unavailable: true,
      fill_width: true,
    });
  }

  // Temperature and colour are secondary controls. Keeping them as compact
  // touch targets leaves the brightness slider readable instead of squeezing
  // three full-width sliders into the same mobile row.
  if (supportsTemperature) {
    controls.push({
      entity: entityId,
      icon: "mdi:thermometer",
      show_background: true,
      state_background: false,
      light_background: true,
      fill_width: false,
      hide_when_parent_unavailable: true,
      tap_action: { action: "more-info" },
    });
  }
  if (supportsColor) {
    controls.push({
      entity: entityId,
      icon: "mdi:palette",
      show_background: true,
      state_background: false,
      light_background: true,
      fill_width: false,
      hide_when_parent_unavailable: true,
      tap_action: { action: "more-info" },
    });
  }

  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "switch",
    entity: entityId,
    use_accent_color: false,
    styles: bubbleLightSurfaceStyles(),
    ...(controls.length
      ? {
          card_layout: "large",
          rows: 2,
          sub_button: {
            main: [],
            bottom: [{ buttons_layout: "inline", justify_content: "fill", group: controls.slice(0, 3) }],
          },
        }
      : {}),
  };
}

function entityToBubbleCard(entity: HassEntity, options: StrategyConfig, hass?: HomeAssistant): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    const useSlider = useAdvancedControls(options) && ["fan", "number", "input_number"].includes(domain);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: useSlider ? "slider" : ["scene", "script", "button"].includes(domain) ? "name" : "switch",
      ...(useSlider ? { slider_value_position: "right" } : {}),
    };
  }

  return bubbleDomainCard(cardType, domain, entity.entity_id, options, hass);
}

function bubbleDomainCard(
  cardType: string,
  domain: string,
  entityId: string | undefined,
  options: StrategyConfig,
  hass?: HomeAssistant,
): LovelaceCard {
  const advanced = Boolean(entityId && useAdvancedControls(options));

  if (domain === "cover" && entityId) {
    const supportedFeatures = Number(hass?.states[entityId]?.attributes.supported_features ?? 0);
    const supportsPosition = Boolean(supportedFeatures & 4);
    const supportsTiltSlider = Boolean(supportedFeatures & 128);
    const sliders: LovelaceCard[] = [];

    if (advanced && supportsPosition) {
      sliders.push({ entity: entityId, sub_button_type: "slider", icon: "mdi:arrow-up-down", show_background: false, state_background: false, use_accent_color: true, fill_width: true, hide_when_parent_unavailable: true });
    }
    if (advanced && supportsTiltSlider) {
      sliders.push({ entity: entityId, sub_button_type: "slider", icon: "mdi:angle-acute", cover_slider_type: "tilt_position", show_background: false, state_background: false, use_accent_color: true, fill_width: true, hide_when_parent_unavailable: true });
    }

    return {
      type: "custom:bubble-card",
      card_type: "cover",
      entity: entityId,
      main_buttons_position: "bottom",
      main_buttons_full_width: true,
      tilt_buttons: supportsTiltSlider ? "hidden" : "bottom",
      ...(sliders.length
        ? { card_layout: "large", rows: 2, sub_button: { main: [], bottom: [{ buttons_layout: "inline", justify_content: "fill", group: sliders }] } }
        : {}),
    };
  }

  return {
    type: "custom:bubble-card",
    card_type: cardType,
    ...(entityId ? { entity: entityId } : {}),
    ...(advanced && domain === "climate"
      ? {
          state_color: true,
          main_buttons_position: "bottom",
          main_buttons_full_width: true,
          sub_button: {
            main: [{
              buttons_layout: "inline",
              group: [{
                entity: entityId,
                sub_button_type: "select",
                select_attribute: "hvac_modes",
                show_state: true,
                show_arrow: false,
                show_background: false,
                fill_width: false,
                hide_when_parent_unavailable: true,
              }],
            }],
            bottom: [],
          },
          card_layout: "large",
          rows: 2,
        }
      : {}),
  };
}

function useAdvancedControls(options: StrategyConfig): boolean {
  return options.enable_advanced_controls ?? DEFAULT_ENABLE_ADVANCED_CONTROLS;
}
