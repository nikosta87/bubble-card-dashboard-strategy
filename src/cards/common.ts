import { ROOMS_POPUP_HASH } from "../constants";
import type { HassArea, LovelaceCard } from "../types";
import { getRoomHash } from "../utils/entities";

export function fixedHomeCard(card: LovelaceCard): LovelaceCard {
  return {
    ...card,
    card_mod: {
      style: `
        ha-card {
          height: 190px;
          min-height: 190px;
          max-height: 190px;
          overflow: hidden;
        }
      `,
    },
  };
}

export function bubbleSeparator(name: string, icon: string): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon,
  };
}

export function buttonToHash(name: string, icon: string, hash: string, entity?: string): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name,
    icon,
    entity,
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: hash,
      },
    },
  };
}

export function buildFooter(areas: HassArea[]): LovelaceCard {
  const footer: LovelaceCard = {
    type: "custom:bubble-card",
    card_type: "horizontal-buttons-stack",
    "1_link": ROOMS_POPUP_HASH,
    "1_name": "Rooms",
    "1_icon": "mdi:floor-plan",
    auto_order: false,
    highlight_current_view: true,
  };

  areas.slice(0, 6).forEach((area, index) => {
    const position = index + 2;
    footer[`${position}_link`] = getRoomHash(area);
    footer[`${position}_name`] = area.name;
    footer[`${position}_icon`] = area.icon || "mdi:home-outline";
  });

  return footer;
}
