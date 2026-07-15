import { DEFAULT_CAMERA_LIVE_VIEW } from "../constants";
import type { HassEntity, HomeAssistant, LovelaceCard, StrategyConfig } from "../types";
import { getFriendlyName } from "../utils/entities";
import { bubblePopup } from "./common";

export function buildCamerasPopup(
  cameras: HassEntity[],
  hass: HomeAssistant,
  options: StrategyConfig,
  name: string,
): LovelaceCard {
  return bubblePopup({
    hash: "#cameras",
    name,
    icon: "mdi:video",
    cards: [
      {
        type: "grid",
        square: false,
        columns: cameras.length === 1 ? 1 : 2,
        cards: cameras.map((camera) => ({
          type: "picture-entity",
          entity: camera.entity_id,
          name: getFriendlyName(camera, hass),
          camera_view: (options.camera_live_view ?? DEFAULT_CAMERA_LIVE_VIEW) ? "live" : "auto",
          show_name: true,
          show_state: false,
        })),
      },
    ],
  });
}
