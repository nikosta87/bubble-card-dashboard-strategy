import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  StrategyConfig,
} from "../types";
import { bubbleSeparator } from "../cards/common";
import { entityToCard } from "../cards/entity-cards";
import { getAreaEntities, getDomain } from "../utils/entities";

// Theme views group the whole home by function ("all lights", "all covers", ...)
// instead of by room. Each theme becomes its own Bubble Card pop-up, reachable
// from a compact navigation bar on the home view.
type ThemeDefinition = {
  id: string;
  title: string;
  icon: string;
  domains: string[];
  columns: number;
};

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: "lights",
    title: "Lights",
    icon: "mdi:lightbulb-group",
    domains: ["light"],
    columns: 2,
  },
  {
    id: "covers",
    title: "Covers",
    icon: "mdi:window-shutter",
    domains: ["cover"],
    columns: 1,
  },
  {
    id: "climate",
    title: "Climate",
    icon: "mdi:thermostat",
    domains: ["climate", "fan", "humidifier"],
    columns: 2,
  },
  {
    id: "media",
    title: "Media",
    icon: "mdi:speaker",
    domains: ["media_player"],
    columns: 2,
  },
];

type ActiveTheme = ThemeDefinition & {
  areas: Array<{ area: HassArea; entities: HassEntity[] }>;
};

/**
 * Returns the themes that actually have matching entities somewhere in the home,
 * each already resolved to its per-area entity groups. Empty themes are dropped
 * so the navigation never links to a blank pop-up.
 */
export function getActiveThemes(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): ActiveTheme[] {
  return THEME_DEFINITIONS.map((theme) => {
    const themeAreas = areas
      .map((area) => ({
        area,
        entities: getAreaEntities(area.area_id, entities, devices, hass, options).filter((entity) =>
          theme.domains.includes(getDomain(entity.entity_id)),
        ),
      }))
      .filter((group) => group.entities.length > 0);

    return { ...theme, areas: themeAreas };
  }).filter((theme) => theme.areas.length > 0);
}

/** Builds the inline chip bar that links to each active theme pop-up. */
export function buildThemeNavigation(themes: ActiveTheme[]): LovelaceCard {
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
          justify_content: "center",
          group: themes.map((theme) => ({
            name: theme.title,
            icon: theme.icon,
            show_name: true,
            fill_width: false,
            tap_action: {
              action: "navigate",
              navigation_path: `#${theme.id}`,
            },
          })),
        },
      ],
    },
  };
}

/** Builds one pop-up per theme, listing its entities grouped by area. */
export function buildThemePopups(
  themes: ActiveTheme[],
  options: StrategyConfig,
  sonosEntities: string[] = [],
): LovelaceCard[] {
  return themes.map((theme) => buildThemePopup(theme, options, sonosEntities));
}

function buildThemePopup(theme: ActiveTheme, options: StrategyConfig, sonosEntities: string[]): LovelaceCard {
  const cards: LovelaceCard[] = [];

  theme.areas.forEach((group) => {
    cards.push(bubbleSeparator(group.area.name, group.area.icon || "mdi:home-outline"));
    cards.push({
      type: "grid",
      square: false,
      columns: theme.columns,
      cards: group.entities.map((entity) => entityToCard(entity, options, sonosEntities)),
    });
  });

  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: `#${theme.id}`,
    name: theme.title,
    icon: theme.icon,
    popup_mode: "centered",
    width_desktop: "680px",
    bg_opacity: "85",
    bg_blur: "12",
    show_previous_button: true,
    close_by_clicking_outside: true,
    cards,
  };
}
