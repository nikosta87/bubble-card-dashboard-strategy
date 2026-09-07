import { ROOMS_POPUP_HASH } from "../constants";
import { DESIGN, bubbleThemeStyles } from "../design";
import type { HassArea, LovelaceCard } from "../types";
import { getRoomHash } from "../utils/entities";

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
    popup_mode: "adaptive-dialog",
    popup_style: "bubble",
    performance_mode: "performance",
    with_bottom_offset: true,
    width_desktop: DESIGN.popup.widthDesktop,
    bg_opacity: DESIGN.popup.bgOpacity,
    bg_blur: DESIGN.popup.bgBlur,
    show_previous_button: config.showPreviousButton ?? false,
    close_by_clicking_outside: true,
    styles: bubbleThemeStyles(),
    cards: config.cards,
  };
}

export function bubbleSeparator(name: string, icon: string): LovelaceCard {
  return { type: "custom:bubble-card", card_type: "separator", name, icon };
}

export function buttonToHash(name: string, icon: string, hash: string, entity?: string): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name,
    icon,
    entity,
    button_action: { tap_action: { action: "navigate", navigation_path: hash } },
  };
}

/** Mobile-first Bubble footer. Kept intentionally short: rooms are the primary navigation. */
export function buildFooter(areas: HassArea[], roomsLabel = "Rooms"): LovelaceCard {
  const group: LovelaceCard[] = [
    {
      name: roomsLabel,
      icon: "mdi:floor-plan",
      show_name: true,
      fill_width: true,
      tap_action: { action: "navigate", navigation_path: ROOMS_POPUP_HASH },
    },
    ...areas.slice(0, 4).map((area) => ({
      name: area.name,
      icon: area.icon || "mdi:home-outline",
      show_name: false,
      fill_width: true,
      tap_action: { action: "navigate", navigation_path: getRoomHash(area) },
    })),
  ];

  return {
    type: "custom:bubble-card",
    card_type: "sub-buttons",
    footer_mode: true,
    footer_full_width: true,
    footer_bottom_offset: 12,
    rows: 0.941,
    sub_button: {
      main: [],
      bottom: [{ name: "Navigation", buttons_layout: "inline", justify_content: "fill", group }],
    },
  };
}
