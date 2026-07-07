import {
  DEFAULT_SHOW_CAMERA_BUTTON,
  ROOMS_POPUP_HASH,
} from "../constants";
import type { HomeAssistant, LovelaceCard, StrategyConfig } from "../types";
import { getUserInitial } from "../utils/entities";

export function buildTopNavigation(hass: HomeAssistant, options: StrategyConfig): LovelaceCard {
  const showCameraButton = options.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON;

  return {
    type: "horizontal-stack",
    cards: [
      subButtonBar(
        [
          profileSubButton(hass, options),
          navigationSubButton("Home", "mdi:home", ROOMS_POPUP_HASH),
        ],
        "flex-start",
      ),
      subButtonBar(
        [
          ...(showCameraButton ? [navigationSubButton("Cameras", "mdi:video", "#cameras")] : []),
        ],
        "center",
      ),
      subButtonBar([navigationSubButton("", "mdi:cog", "/config/dashboard")], "flex-end"),
    ],
  };
}

function subButtonBar(group: LovelaceCard[], justifyContent: "flex-start" | "center" | "flex-end"): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "sub-buttons",
    hide_main_background: true,
    rows: 0.92,
    sub_button: {
      main: [],
      bottom: [
        {
          buttons_layout: "inline",
          justify_content: justifyContent,
          group,
        },
      ],
    },
  };
}

function profileSubButton(hass: HomeAssistant, options: StrategyConfig): LovelaceCard {
  const image = options.profile_image;

  return {
    name: getUserInitial(hass),
    icon: image ? undefined : "mdi:account",
    image,
    show_name: !image,
    show_icon: !image,
    fill_width: false,
    tap_action: {
      action: "none",
    },
  };
}

function navigationSubButton(name: string, icon: string, navigationPath: string): LovelaceCard {
  return {
    name,
    icon,
    show_name: Boolean(name),
    fill_width: false,
    tap_action: {
      action: "navigate",
      navigation_path: navigationPath,
    },
  };
}
