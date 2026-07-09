import {
  DEFAULT_BATTERY_CRITICAL_BELOW,
  DEFAULT_HIDE_MOBILE_APP_BATTERIES,
  DEFAULT_THEME_GROUPING,
} from "../constants";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  LovelaceCard,
  StrategyConfig,
  ThemeGrouping,
} from "../types";
import { autoEntitiesGrid, type AutoEntitiesFilter } from "../cards/auto-entities";
import { bubblePopup, bubbleSeparator } from "../cards/common";
import { entityCardTemplate, entityToCard } from "../cards/entity-cards";
import { bubbleThemeStyles, summaryTileLayout } from "../design";
import { getAreaEntities, getDomain, getFriendlyName } from "../utils/entities";

// Summaries group the whole home by function ("all lights", "security", ...)
// instead of by room. Each enabled summary becomes a Bubble Card pop-up reachable
// from a grid of summary buttons on the home view. Which summaries appear, and
// how they are laid out, is controlled from the graphical editor.
type DomainSummary = {
  kind: "domain";
  id: string;
  title: string;
  icon: string;
  configKey: SummaryConfigKey;
  domains: string[];
  columns: number;
};

type SpecialSummary = {
  kind: "security" | "battery";
  id: string;
  title: string;
  icon: string;
  configKey: SummaryConfigKey;
};

type SummaryDefinition = DomainSummary | SpecialSummary;

type SummaryConfigKey =
  | "show_light_summary"
  | "show_security_summary"
  | "show_climate_summary"
  | "show_battery_summary";

type ThemeEntry = {
  area: HassArea;
  entity: HassEntity;
};

type ResolvedDomainSummary = DomainSummary & { entries: ThemeEntry[] };
type ResolvedSpecialSummary = SpecialSummary & { entries: ThemeEntry[] };
type ResolvedSummary = ResolvedDomainSummary | ResolvedSpecialSummary;

// The states that count as "on"/active per domain when grouping lights/climate
// by status. Used to build the auto-entities filters for the On and Off groups.
const DOMAIN_STATE_BUCKETS: Record<string, { on: string[]; off: string[] }> = {
  light: { on: ["on"], off: ["off"] },
  climate: { on: ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"], off: ["off"] },
  fan: { on: ["on"], off: ["off"] },
  humidifier: { on: ["on"], off: ["off"] },
};

const SECURITY_DEVICE_CLASSES = [
  "motion",
  "occupancy",
  "moving",
  "presence",
  "door",
  "garage_door",
  "window",
  "opening",
  "smoke",
  "gas",
  "carbon_monoxide",
  "moisture",
  "safety",
  "tamper",
  "vibration",
  "sound",
];

const SUMMARIES: SummaryDefinition[] = [
  {
    kind: "domain",
    id: "lights",
    title: "Lights",
    icon: "mdi:lightbulb-group",
    configKey: "show_light_summary",
    domains: ["light"],
    columns: 2,
  },
  {
    kind: "security",
    id: "security",
    title: "Security",
    icon: "mdi:shield-home",
    configKey: "show_security_summary",
  },
  {
    kind: "domain",
    id: "climate",
    title: "Climate",
    icon: "mdi:thermostat",
    configKey: "show_climate_summary",
    domains: ["climate", "fan", "humidifier"],
    columns: 2,
  },
  {
    kind: "battery",
    id: "batteries",
    title: "Batteries",
    icon: "mdi:battery-50",
    configKey: "show_battery_summary",
  },
];

/**
 * Returns the summaries that are both enabled in the config and actually have
 * matching entities, so the navigation never links to an empty pop-up.
 */
export function getActiveSummaries(
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): ResolvedSummary[] {
  return SUMMARIES.filter((summary) => isSummaryEnabled(summary, options))
    .map((summary): ResolvedSummary => ({ ...summary, entries: resolveEntries(summary, areas, entities, devices, hass, options) }))
    .filter((summary) => summaryHasContent(summary, hass));
}

function isSummaryEnabled(summary: SummaryDefinition, options: StrategyConfig): boolean {
  const value = options[summary.configKey];
  return value === undefined ? true : Boolean(value);
}

function resolveEntries(
  summary: SummaryDefinition,
  areas: HassArea[],
  entities: HassEntity[],
  devices: HassDevice[],
  hass: HomeAssistant,
  options: StrategyConfig,
): ThemeEntry[] {
  if (summary.kind !== "domain") {
    return [];
  }

  const entries: ThemeEntry[] = [];
  areas.forEach((area) => {
    getAreaEntities(area.area_id, entities, devices, hass, options)
      .filter((entity) => summary.domains.includes(getDomain(entity.entity_id)))
      .forEach((entity) => entries.push({ area, entity }));
  });

  return entries;
}

function summaryHasContent(summary: ResolvedSummary, hass: HomeAssistant): boolean {
  if (summary.kind === "domain") {
    return summary.entries.length > 0;
  }

  const predicate = summary.kind === "security" ? isSecurityState : isBatteryState;
  return Object.values(hass.states).some(predicate);
}

function isSecurityState(state: HomeAssistant["states"][string]): boolean {
  const domain = getDomain(state.entity_id);

  if (domain === "lock" || domain === "alarm_control_panel") {
    return true;
  }

  if (domain === "binary_sensor") {
    return SECURITY_DEVICE_CLASSES.includes(String(state.attributes.device_class ?? ""));
  }

  return false;
}

function isBatteryState(state: HomeAssistant["states"][string]): boolean {
  return getDomain(state.entity_id) === "sensor" && state.attributes.device_class === "battery";
}

/** Builds the grid of informative summary tiles on the home view. */
export function buildSummaryNavigation(
  summaries: ResolvedSummary[],
  columns: number,
  options: StrategyConfig,
): LovelaceCard {
  return {
    type: "grid",
    square: false,
    columns,
    cards: summaries.map((summary) => buildSummaryTile(summary, columns, options)),
  };
}

function buildSummaryTile(summary: ResolvedSummary, columns: number, options: StrategyConfig): LovelaceCard {
  const counter = summaryCounter(summary, options);

  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name: summary.title,
    icon: summary.icon,
    card_layout: summaryTileLayout(columns),
    styles: bubbleThemeStyles(),
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: `#${summary.id}`,
      },
    },
    ...(counter ? { sub_button: [counter] } : {}),
  };
}

// A single live-count chip per tile, only where a count is meaningful, so the
// tiles stay informative without being overloaded.
function summaryCounter(summary: ResolvedSummary, options: StrategyConfig): LovelaceCard | undefined {
  const counter = COUNTER_TEMPLATES[summary.id]?.(options);

  if (!counter) {
    return undefined;
  }

  return {
    name: counter.template,
    icon: counter.icon,
    show_name: true,
    show_icon: true,
    show_background: true,
    tap_action: { action: "none" },
  };
}

const SECURITY_CLASSES_JS = SECURITY_DEVICE_CLASSES.map((deviceClass) => `'${deviceClass}'`).join(",");

const COUNTER_TEMPLATES: Record<string, (options: StrategyConfig) => { icon: string; template: string }> = {
  lights: () => ({
    icon: "mdi:lightbulb",
    template: "${Object.values(hass.states).filter(s => s.entity_id.startsWith('light.') && s.state === 'on').length}",
  }),
  climate: () => ({
    icon: "mdi:fire",
    template:
      "${Object.values(hass.states).filter(s => s.entity_id.startsWith('climate.') && !['off','unavailable','unknown'].includes(s.state)).length}",
  }),
  security: () => ({
    icon: "mdi:shield-alert",
    template: `\${Object.values(hass.states).filter(s => (s.entity_id.startsWith('binary_sensor.') && s.state === 'on' && [${SECURITY_CLASSES_JS}].includes(s.attributes.device_class)) || (s.entity_id.startsWith('lock.') && s.state === 'unlocked') || (s.entity_id.startsWith('alarm_control_panel.') && String(s.state).startsWith('armed'))).length}`,
  }),
  batteries: (options) => {
    const threshold = options.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
    return {
      icon: "mdi:battery-alert",
      template: `\${Object.values(hass.states).filter(s => s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'battery' && Number(s.state) < ${threshold}).length}`,
    };
  },
};

/** Builds one pop-up per active summary. */
export function buildSummaryPopups(
  summaries: ResolvedSummary[],
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[] = [],
): LovelaceCard[] {
  return summaries.map((summary) => buildSummaryPopup(summary, hass, options, sonosEntities));
}

function buildSummaryPopup(
  summary: ResolvedSummary,
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
): LovelaceCard {
  const cards = buildSummaryCards(summary, hass, options, sonosEntities);

  return bubblePopup({
    hash: `#${summary.id}`,
    name: summary.title,
    icon: summary.icon,
    cards,
  });
}

function buildSummaryCards(
  summary: ResolvedSummary,
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
): LovelaceCard[] {
  if (summary.kind !== "domain") {
    return summary.kind === "security" ? buildSecurityCards(hass) : buildBatteryCards(options);
  }

  const grouping = options.theme_grouping ?? DEFAULT_THEME_GROUPING;
  return grouping === "state"
    ? buildStateGroupedCards(summary)
    : buildStaticGroupedCards(summary, grouping, hass, options, sonosEntities);
}

// --- Lights / Climate ---------------------------------------------------------

// Status grouping uses auto-entities so the On/Off groups update live and stay
// sorted alphabetically as entities change state.
function buildStateGroupedCards(summary: ResolvedDomainSummary): LovelaceCard[] {
  return [
    bubbleSeparator("On", "mdi:toggle-switch"),
    autoEntitiesGrid({ columns: summary.columns, include: buildStateIncludes(summary.domains, "on") }),
    bubbleSeparator("Off", "mdi:toggle-switch-off-outline"),
    autoEntitiesGrid({ columns: summary.columns, include: buildStateIncludes(summary.domains, "off") }),
  ];
}

function buildStateIncludes(domains: string[], bucket: "on" | "off"): AutoEntitiesFilter[] {
  return domains.flatMap((domain) =>
    (DOMAIN_STATE_BUCKETS[domain]?.[bucket] ?? []).map((state) => ({
      domain,
      state,
      options: entityCardTemplate(domain),
    })),
  );
}

function buildStaticGroupedCards(
  summary: ResolvedDomainSummary,
  grouping: ThemeGrouping,
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
): LovelaceCard[] {
  const sections = groupEntries(summary, grouping, hass);
  const cards: LovelaceCard[] = [];

  sections.forEach((section) => {
    if (section.title) {
      cards.push(bubbleSeparator(section.title, section.icon));
    }
    cards.push({
      type: "grid",
      square: false,
      columns: summary.columns,
      cards: section.entities.map((entity) => entityToCard(entity, options, sonosEntities)),
    });
  });

  return cards;
}

type SummarySection = {
  title: string | null;
  icon: string;
  entities: HassEntity[];
};

function groupEntries(summary: ResolvedDomainSummary, grouping: ThemeGrouping, hass: HomeAssistant): SummarySection[] {
  if (grouping === "none") {
    const entities = [...summary.entries]
      .map((entry) => entry.entity)
      .sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
    return [{ title: null, icon: "", entities }];
  }

  // Default: group by room/area, preserving the order areas appear in.
  const sections: SummarySection[] = [];
  const indexByArea = new Map<string, number>();

  summary.entries.forEach((entry) => {
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

// --- Security -----------------------------------------------------------------

const SECURITY_HAZARD_CLASSES = ["smoke", "gas", "carbon_monoxide", "moisture"];
const SECURITY_OPENING_CLASSES = ["door", "garage_door", "window", "opening"];
const SECURITY_MOTION_CLASSES = ["motion", "occupancy", "moving", "presence", "vibration", "sound"];

const SECURITY_BUTTON_TEMPLATE = { type: "custom:bubble-card", card_type: "button", button_type: "state" };
const SECURITY_LOCK_TEMPLATE = { type: "custom:bubble-card", card_type: "button", button_type: "switch" };
const SECURITY_ALARM_TEMPLATE = { type: "custom:bubble-card", card_type: "button" };

// Security is presented as logical groups (alarm, locks, hazards, doors/windows
// split by open/closed, motion) rather than a raw active/clear split. Only groups
// that actually have entities are rendered.
function buildSecurityCards(hass: HomeAssistant): LovelaceCard[] {
  const cards: LovelaceCard[] = [];

  if (hasDomain(hass, "alarm_control_panel")) {
    cards.push(bubbleSeparator("Alarm", "mdi:shield-home"));
    cards.push(autoEntitiesGrid({ columns: 1, include: [{ domain: "alarm_control_panel", options: SECURITY_ALARM_TEMPLATE }] }));
  }

  if (hasDomain(hass, "lock")) {
    cards.push(bubbleSeparator("Locks", "mdi:lock"));
    cards.push(autoEntitiesGrid({ columns: 2, include: [{ domain: "lock", options: SECURITY_LOCK_TEMPLATE }] }));
  }

  if (hasBinarySensorClass(hass, SECURITY_HAZARD_CLASSES)) {
    cards.push(bubbleSeparator("Smoke & Leaks", "mdi:smoke-detector"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_HAZARD_CLASSES) }));
  }

  if (hasBinarySensorClass(hass, SECURITY_OPENING_CLASSES)) {
    cards.push(bubbleSeparator("Doors & Windows – Open", "mdi:door-open"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_OPENING_CLASSES, "on") }));
    cards.push(bubbleSeparator("Doors & Windows – Closed", "mdi:door-closed"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_OPENING_CLASSES, "off") }));
  }

  if (hasBinarySensorClass(hass, SECURITY_MOTION_CLASSES)) {
    cards.push(bubbleSeparator("Motion & Presence", "mdi:motion-sensor"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_MOTION_CLASSES) }));
  }

  return cards;
}

function securityClassIncludes(deviceClasses: string[], state?: string): AutoEntitiesFilter[] {
  return deviceClasses.map((deviceClass) => ({
    domain: "binary_sensor",
    attributes: { device_class: deviceClass },
    ...(state ? { state } : {}),
    options: SECURITY_BUTTON_TEMPLATE,
  }));
}

function hasDomain(hass: HomeAssistant, domain: string): boolean {
  return Object.keys(hass.states).some((entityId) => getDomain(entityId) === domain);
}

function hasBinarySensorClass(hass: HomeAssistant, deviceClasses: string[]): boolean {
  return Object.values(hass.states).some(
    (state) =>
      getDomain(state.entity_id) === "binary_sensor" &&
      deviceClasses.includes(String(state.attributes.device_class ?? "")),
  );
}

// --- Batteries ----------------------------------------------------------------

function buildBatteryCards(options: StrategyConfig): LovelaceCard[] {
  const template = { type: "custom:bubble-card", card_type: "button", button_type: "state" };
  const threshold = options.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
  const hideMobile = options.hide_mobile_app_batteries ?? DEFAULT_HIDE_MOBILE_APP_BATTERIES;
  const exclude = hideMobile ? [{ integration: "mobile_app" }] : undefined;
  const sort = { method: "state", numeric: true };

  const batteryInclude = (state: string): AutoEntitiesFilter[] => [
    { domain: "sensor", attributes: { device_class: "battery" }, state, options: template },
  ];

  return [
    bubbleSeparator("Critical", "mdi:battery-alert"),
    autoEntitiesGrid({ columns: 2, include: batteryInclude(`< ${threshold}`), exclude, sort }),
    bubbleSeparator("OK", "mdi:battery"),
    autoEntitiesGrid({ columns: 2, include: batteryInclude(`>= ${threshold}`), exclude, sort }),
  ];
}
