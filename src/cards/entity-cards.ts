import { DOMAIN_CARD_TYPES } from "../constants";
import type { HassEntity, LovelaceCard, StrategyConfig } from "../types";
import { getDomain } from "../utils/entities";
import { mediaPlayerToCard } from "./media-player";

type RoomEntityGroup = {
  title: string;
  icon: string;
  domains: string[];
  columns: number;
  entities: HassEntity[];
};

export function groupRoomEntities(entities: HassEntity[]): RoomEntityGroup[] {
  const groupDefinitions = [
    {
      title: "Lights",
      icon: "mdi:lightbulb-group",
      domains: ["light", "switch", "input_boolean"],
      columns: 2,
    },
    {
      title: "Climate",
      icon: "mdi:thermostat",
      domains: ["climate", "fan", "humidifier"],
      columns: 2,
    },
    {
      title: "Media",
      icon: "mdi:speaker",
      domains: ["media_player"],
      columns: 2,
    },
    {
      title: "Covers",
      icon: "mdi:window-shutter",
      domains: ["cover"],
      columns: 1,
    },
    {
      title: "Scenes",
      icon: "mdi:palette",
      domains: ["scene", "script", "button"],
      columns: 2,
    },
    {
      title: "Devices",
      icon: "mdi:power-plug",
      domains: ["alarm_control_panel", "lock", "select", "vacuum"],
      columns: 2,
    },
  ];

  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id))),
  }));
}

export function entityToCard(entity: HassEntity, options: StrategyConfig, sonosEntities: string[] = []): LovelaceCard {
  const domain = getDomain(entity.entity_id);

  if (domain === "media_player") {
    return mediaPlayerToCard(entity.entity_id, options, sonosEntities);
  }

  return entityToBubbleCard(entity);
}

function entityToBubbleCard(entity: HassEntity): LovelaceCard {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";

  if (cardType === "button") {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: ["scene", "script", "button"].includes(domain) ? "name" : "switch",
    };
  }

  return {
    type: "custom:bubble-card",
    card_type: cardType,
    entity: entity.entity_id,
  };
}
