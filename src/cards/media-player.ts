import {
  DEFAULT_ENABLE_SONOS_GROUPING,
  DEFAULT_MEDIA_PLAYER_CARD,
} from "../constants";
import type { LovelaceCard, MediaPlayerCardType, StrategyConfig } from "../types";

export function mediaPlayerToCard(
  entityId: string,
  options: StrategyConfig,
  sonosEntities: string[] = [],
): LovelaceCard {
  switch (getMediaPlayerCardType(options)) {
    case "mini-media-player":
      return {
        type: "custom:mini-media-player",
        entity: entityId,
        artwork: "material",
        info: "scroll",
        idle_view: {
          when_idle: true,
          when_paused: true,
          when_standby: true,
        },
        ...(shouldAddSonosGrouping(options, sonosEntities)
          ? {
              speaker_group: {
                platform: "sonos",
                entities: sonosEntities,
                sync_volume: true,
                show_group_count: true,
              },
            }
          : {}),
      };
    case "yamp":
      return {
        type: "custom:yet-another-media-player",
        entities: [entityId],
        idle_screen: "search-recently-played",
        artwork_object_fit: "cover",
      };
    case "bubble-card":
    default:
      return {
        type: "custom:bubble-card",
        card_type: "media-player",
        entity: entityId,
      };
  }
}

export function getMediaPlayerCardType(options: StrategyConfig): MediaPlayerCardType {
  const configValue = normalizeMediaPlayerCardType(options.media_player_card);

  if (configValue) {
    return configValue;
  }

  return DEFAULT_MEDIA_PLAYER_CARD;
}

function normalizeMediaPlayerCardType(value?: string): MediaPlayerCardType | undefined {
  const normalizedValue = value?.toLowerCase().trim().replace(/\s+/g, "-").replace(/^yet-another-media-player$/, "yamp");

  if (normalizedValue === "bubble-card" || normalizedValue === "mini-media-player" || normalizedValue === "yamp") {
    return normalizedValue;
  }

  return undefined;
}

function shouldAddSonosGrouping(options: StrategyConfig, sonosEntities: string[]): boolean {
  return (options.enable_sonos_grouping ?? DEFAULT_ENABLE_SONOS_GROUPING) && sonosEntities.length > 1;
}
