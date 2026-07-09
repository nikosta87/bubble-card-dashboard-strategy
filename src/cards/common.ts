import { ROOMS_POPUP_HASH } from "../constants";
import { DESIGN, bubbleThemeStyles } from "../design";
import type { HassArea, LovelaceCard } from "../types";
import { getRoomHash } from "../utils/entities";

export function fixedHomeCard(card: LovelaceCard): LovelaceCard {
  const height = DESIGN.homeCard.height;

  return {
    ...card,
    card_mod: {
      style: `
        ha-card {
          height: ${height};
          min-height: ${height};
          max-height: ${height};
          overflow: hidden;
        }
      `,
    },
  };
}

/** Shared Bubble Card pop-up wrapper, styled from the design tokens. */
export function bubblePopup(config: {
  hash: string;
  name: string;
  icon: string;
  cards: LovelaceCard[];
  showPreviousButton?: boolean;
}): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: config.hash,
    name: config.name,
    icon: config.icon,
    popup_mode: "centered",
    width_desktop: DESIGN.popup.widthDesktop,
    bg_opacity: DESIGN.popup.bgOpacity,
    bg_blur: DESIGN.popup.bgBlur,
    show_previous_button: config.showPreviousButton ?? true,
    close_by_clicking_outside: true,
    styles: bubbleThemeStyles(),
    cards: config.cards,
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
