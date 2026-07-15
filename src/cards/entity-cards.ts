import { DEFAULT_ENABLE_ADVANCED_CONTROLS, DOMAIN_CARD_TYPES } from "../constants";
import type { HassEntity, LovelaceCard, StrategyConfig } from "../types";
import type { TranslationKey } from "../i18n";
import { getDomain } from "../utils/entities";
import { mediaPlayerToCard } from "./media-player";

type RoomEntityGroup = {
  titleKey: TranslationKey;
  icon: string;
  domains: string[];
  columns: number;
  entities: HassEntity[];
};

export function groupRoomEntities(entities: HassEntity[]): RoomEntityGroup[] {
  const groupDefinitions: Omit<RoomEntityGroup, "entities">[] = [
    {
      titleKey: "lights",
      icon: "mdi:lightbulb-group",
      domains: ["light"],
      columns: 2,
    },
    {
      titleKey: "climate",
      icon: "mdi:thermostat",
      domains: ["climate", "fan", "humidifier"],
      columns: 1,
    },
    {
      titleKey: "media",
      icon: "mdi:speaker",
      domains: ["media_player"],
      columns: 1,
    },
    {
      titleKey: "covers",
      icon: "mdi:window-shutter",
      domains: ["cover"],
      columns: 1,
    },
    {
      titleKey: "scenes",
      icon: "mdi:palette",
      domains: ["scene", "script", "button"],
      columns: 2,
    },
    {
      titleKey: "devices",
      icon: "mdi:power-plug",
      domains: [
        "alarm_control_panel",
        "input_boolean",
        "input_number",
        "input_select",
        "lock",
        "number",
        "select",
        "switch",
        "vacuum",
      ],
      columns: 2,
    },
  ];

  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id))),
  }));
}

/**
 * A card template for a domain without a fixed entity. auto-entities injects the
 * matched `entity` into this template, so it must not carry one itself.
 */
export function entityCardTemplate(domain: string, options: StrategyConfig = {}): LovelaceCard {
  // auto-entities injects `entity`, so this template must not carry one itself.
  if (domain === "media_player") {
    return { type: "custom:bubble-card", card_type: "media-player" };
  }

  const cardType = DOMAIN_CARD_TYPES[domain] || "button";

  if (cardType === "button") {
    const useSlider = useAdvancedControls(options) && ["light", "fan", "number", "input_number"].includes(domain);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: useSlider ? "slider" : ["scene", "script", "button"].includes(domain) ? "name" : "switch",
      ...(useSlider ? { slider_value_position: "right" } : {}),
    };
  }

  return bubbleDomainCard(cardType, domain, undefined, options);
}

export function entityToCard(entity: HassEntity, options: StrategyConfig): LovelaceCard {
  const domain = getDomain(entity.entity_id);

  if (domain === "media_player") {
    return mediaPlayerToCard(entity.entity_id, options);
  }

  return entityToBubbleCard(entity, options);
}

function entityToBubbleCard(entity: HassEntity, options: StrategyConfig): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";

  if (cardType === "button") {
    const useSlider = useAdvancedControls(options) && ["light", "fan", "number", "input_number"].includes(domain);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: useSlider ? "slider" : ["scene", "script", "button"].includes(domain) ? "name" : "switch",
      ...(useSlider ? { slider_value_position: "right" } : {}),
    };
  }

  return bubbleDomainCard(cardType, domain, entity.entity_id, options);
}

function bubbleDomainCard(
  cardType: string,
  domain: string,
  entityId: string | undefined,
  options: StrategyConfig,
): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: cardType,
    ...(entityId ? { entity: entityId } : {}),
    ...(entityId && useAdvancedControls(options) && domain === "climate"
      ? {
          sub_button: {
            main: [],
            bottom: [
              {
                buttons_layout: "inline",
                justify_content: "start",
                group: [
                  {
                    entity: entityId,
                    sub_button_type: "select",
                    select_attribute: "hvac_modes",
                    show_state: true,
                    fill_width: false,
                  },
                ],
              },
            ],
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
