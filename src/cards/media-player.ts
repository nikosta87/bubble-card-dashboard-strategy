import { DEFAULT_ENABLE_ADVANCED_CONTROLS } from "../constants";
import type { LovelaceCard, StrategyConfig } from "../types";

export function mediaPlayerToCard(entityId: string, options: StrategyConfig): LovelaceCard {
  const advanced = options.enable_advanced_controls ?? DEFAULT_ENABLE_ADVANCED_CONTROLS;

  return {
    type: "custom:bubble-card",
    card_type: "media-player",
    entity: entityId,
    show_state: true,
    cover_background: true,
    main_buttons_position: "bottom",
    main_buttons_full_width: true,
    hide: {
      previous_button: true,
      next_button: true,
    },
    ...(advanced
      ? {
          card_layout: "large",
          rows: 2,
          sub_button: {
            main: [],
            bottom: [
              {
                buttons_layout: "inline",
                justify_content: "fill",
                group: [
                  {
                    entity: entityId,
                    sub_button_type: "slider",
                    always_visible: true,
                    show_button_info: true,
                    slider_value_position: "right",
                    fill_width: true,
                    hide_when_parent_unavailable: true,
                  },
                ],
              },
            ],
          },
        }
      : {}),
  };
}
