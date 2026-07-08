import { DEFAULT_THEME_GROUPING } from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  StrategyConfig,
  ThemeGrouping,
} from "../types";
import { bubbleSeparator } from "../cards/common";
import { entityToCard } from "../cards/entity-cards";
import { getAreaEntities, getDomain, getFriendlyName } from "../utils/entities";

// Theme views group the whole home by function ("all lights", "all covers", ...)
// instead of by room. Each theme becomes its own Bubble Card pop-up, reachable
// from a compact navigation bar on the home view. How the entities inside a
// theme are grouped is configurable (by room, by on/off status, or not at all).
type ThemeDefinition = {
  id: string;
  title: string;
  icon: string;
  domains: string[];
  columns: number;
};

type ThemeEntry = {
  area: HassArea;
  entity: HassEntity;
};

type ActiveTheme = ThemeDefinition & {
  entries: ThemeEntry[];
};

// States that count as "on"/active when grouping by status. Everything else
// (off, closed, idle, unavailable, ...) is treated as inactive.
const ACTIVE_STATES = new Set(["on", "open", "playing", "heat", "cool", "heat_cool", "auto", "dry", "fan_only", "home", "cleaning"]);

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

/**
 * Returns the themes that actually have matching entities somewhere in the home,
 * each already resolved to a flat, area-tagged entity list. Empty themes are
 * dropped so the navigation never links to a blank pop-up.
 */
export function getActiveThemes(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): ActiveTheme[] {
  return THEME_DEFINITIONS.map((theme) => {
    const entries: ThemeEntry[] = [];

    areas.forEach((area) => {
      getAreaEntities(area.area_id, entities, devices, hass, options)
        .filter((entity) => theme.domains.includes(getDomain(entity.entity_id)))
        .forEach((entity) => entries.push({ area, entity }));
    });

    return { ...theme, entries };
  }).filter((theme) => theme.entries.length > 0);
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

/** Builds one pop-up per theme, grouping its entities per the chosen mode. */
export function buildThemePopups(
  themes: ActiveTheme[],
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[] = [],
): LovelaceCard[] {
  const grouping = options.theme_grouping ?? DEFAULT_THEME_GROUPING;
  return themes.map((theme) => buildThemePopup(theme, grouping, hass, options, sonosEntities));
}

function buildThemePopup(
  theme: ActiveTheme,
  grouping: ThemeGrouping,
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
): LovelaceCard {
  const sections = groupThemeEntries(theme, grouping, hass);
  const cards: LovelaceCard[] = [];

  sections.forEach((section) => {
    if (section.title) {
      cards.push(bubbleSeparator(section.title, section.icon));
    }
    cards.push({
      type: "grid",
      square: false,
      columns: theme.columns,
      cards: section.entities.map((entity) => entityToCard(entity, options, sonosEntities)),
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

type ThemeSection = {
  title: string | null;
  icon: string;
  entities: HassEntity[];
};

function groupThemeEntries(theme: ActiveTheme, grouping: ThemeGrouping, hass: HomeAssistant): ThemeSection[] {
  if (grouping === "none") {
    const entities = [...theme.entries]
      .map((entry) => entry.entity)
      .sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
    return [{ title: null, icon: "", entities }];
  }

  if (grouping === "state") {
    const active = theme.entries.filter((entry) => isEntityActive(hass, entry.entity.entity_id)).map((entry) => entry.entity);
    const inactive = theme.entries.filter((entry) => !isEntityActive(hass, entry.entity.entity_id)).map((entry) => entry.entity);

    return [
      { title: "On", icon: "mdi:toggle-switch", entities: active },
      { title: "Off", icon: "mdi:toggle-switch-off-outline", entities: inactive },
    ].filter((section) => section.entities.length > 0);
  }

  // Default: group by room/area, preserving the order areas appear in.
  const sections: ThemeSection[] = [];
  const indexByArea = new Map<string, number>();

  theme.entries.forEach((entry) => {
    let index = indexByArea.get(entry.area.area_id);
    if (index === undefined) {
      index = sections.length;
      indexByArea.set(entry.area.area_id, index);
      sections.push({ title: entry.area.name, icon: entry.area.icon || "mdi:home-outline", entities: [] });
    }
    sections[index].entities.push(entry.entity);
  });

  return sections;
}

function isEntityActive(hass: HomeAssistant, entityId: string): boolean {
  return ACTIVE_STATES.has(hass.states[entityId]?.state ?? "");
}
