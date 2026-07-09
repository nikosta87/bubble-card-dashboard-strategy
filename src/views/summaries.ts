import {
  DEFAULT_BATTERY_CRITICAL_BELOW,
  DEFAULT_HIDE_MOBILE_APP_BATTERIES,
  DEFAULT_SHOW_ALARM_CONTROLS,
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
import { DESIGN, summaryTileLayout, tileStyles } from "../design";
import { type TranslationKey, type Translator } from "../i18n";
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
  // Default grouping when the user hasn't chosen one explicitly. Lights read
  // best by on/off status, climate reads best by room.
  defaultGrouping: ThemeGrouping;
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
    defaultGrouping: "state",
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
    defaultGrouping: "area",
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
  t: Translator,
): LovelaceCard {
  return {
    type: "grid",
    square: false,
    columns,
    cards: summaries.map((summary) => buildSummaryTile(summary, columns, options, t)),
  };
}

function buildSummaryTile(summary: ResolvedSummary, columns: number, options: StrategyConfig, t: Translator): LovelaceCard {
  const counter = COUNTER_EXPRESSIONS[summary.id]?.(options);

  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name: t(summary.id as TranslationKey),
    icon: summary.icon,
    card_layout: summaryTileLayout(columns),
    // The counter value is written into the sub-button from the styles template
    // (Bubble Card only evaluates templates there), so the sub-button just needs
    // a placeholder that gets overwritten live.
    styles: tileStyles(counter?.expression),
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: `#${summary.id}`,
      },
    },
    ...(counter
      ? {
          sub_button: [
            {
              name: "0",
              icon: counter.icon,
              show_name: true,
              show_icon: true,
              show_background: true,
              tap_action: { action: "none" },
            },
          ],
        }
      : {}),
  };
}

const SECURITY_CLASSES_JS = SECURITY_DEVICE_CLASSES.map((deviceClass) => `'${deviceClass}'`).join(",");

// A single live-count expression per tile, only where a count is meaningful, so
// the tiles stay informative without being overloaded. Each returns a raw JS
// expression evaluated inside the Bubble Card styles template (where `hass` is
// available).
const COUNTER_EXPRESSIONS: Record<string, (options: StrategyConfig) => { icon: string; expression: string }> = {
  lights: () => ({
    icon: "mdi:lightbulb",
    expression: "Object.values(hass.states).filter(s => s.entity_id.startsWith('light.') && s.state === 'on').length",
  }),
  climate: () => ({
    icon: "mdi:fire",
    expression:
      "Object.values(hass.states).filter(s => s.entity_id.startsWith('climate.') && !['off','unavailable','unknown'].includes(s.state)).length",
  }),
  security: () => ({
    icon: "mdi:shield-alert",
    expression: `Object.values(hass.states).filter(s => (s.entity_id.startsWith('binary_sensor.') && s.state === 'on' && [${SECURITY_CLASSES_JS}].includes(s.attributes.device_class)) || (s.entity_id.startsWith('lock.') && s.state === 'unlocked') || (s.entity_id.startsWith('alarm_control_panel.') && String(s.state).startsWith('armed'))).length`,
  }),
  batteries: (options) => {
    const threshold = options.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
    return {
      icon: "mdi:battery-alert",
      expression: `Object.values(hass.states).filter(s => s.entity_id.startsWith('sensor.') && s.attributes.device_class === 'battery' && Number(s.state) < ${threshold}).length`,
    };
  },
};

/** Builds one pop-up per active summary. */
export function buildSummaryPopups(
  summaries: ResolvedSummary[],
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[] = [],
  t: Translator,
): LovelaceCard[] {
  return summaries.map((summary) => buildSummaryPopup(summary, hass, options, sonosEntities, t));
}

function buildSummaryPopup(
  summary: ResolvedSummary,
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
  t: Translator,
): LovelaceCard {
  const cards = buildSummaryCards(summary, hass, options, sonosEntities, t);

  return bubblePopup({
    hash: `#${summary.id}`,
    name: t(summary.id as TranslationKey),
    icon: summary.icon,
    cards,
  });
}

function buildSummaryCards(
  summary: ResolvedSummary,
  hass: HomeAssistant,
  options: StrategyConfig,
  sonosEntities: string[],
  t: Translator,
): LovelaceCard[] {
  if (summary.kind !== "domain") {
    return summary.kind === "security" ? buildSecurityCards(hass, options, t) : buildBatteryCards(options, t);
  }

  // The global theme_grouping option, when set, overrides the per-summary
  // default (lights: status, climate: room).
  const grouping = options.theme_grouping ?? summary.defaultGrouping;
  return grouping === "state"
    ? buildStateGroupedCards(summary, t)
    : buildStaticGroupedCards(summary, grouping, hass, options, sonosEntities);
}

// --- Lights / Climate ---------------------------------------------------------

// Status grouping uses auto-entities so the On/Off groups update live and stay
// sorted alphabetically as entities change state. Each separator hides itself
// when its group is empty and (for lights) carries an "all on/off" master button.
function buildStateGroupedCards(summary: ResolvedDomainSummary, t: Translator): LovelaceCard[] {
  const isLights = summary.domains.includes("light");

  return [
    stateSeparator(
      t("on"),
      "mdi:toggle-switch",
      stateCountExpression(summary.domains, "on"),
      isLights ? masterSubButton(t("allOff"), "mdi:lightbulb-off", "light.turn_off") : undefined,
    ),
    autoEntitiesGrid({ columns: summary.columns, include: buildStateIncludes(summary.domains, "on") }),
    stateSeparator(
      t("off"),
      "mdi:toggle-switch-off-outline",
      stateCountExpression(summary.domains, "off"),
      isLights ? masterSubButton(t("allOn"), "mdi:lightbulb-on", "light.turn_on") : undefined,
    ),
    autoEntitiesGrid({ columns: summary.columns, include: buildStateIncludes(summary.domains, "off") }),
  ];
}

// A separator that collapses (display:none) when no entity matches its group,
// so an empty "On"/"Off" section leaves no dangling heading.
function stateSeparator(name: string, icon: string, countExpression: string, master?: LovelaceCard): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon,
    styles: `\${card.style.display = (${countExpression} > 0) ? '' : 'none'}`,
    ...(master ? { sub_button: [master] } : {}),
  };
}

function masterSubButton(name: string, icon: string, service: string): LovelaceCard {
  return {
    name,
    icon,
    show_name: true,
    show_icon: true,
    show_background: true,
    tap_action: {
      action: "call-service",
      service,
      target: { entity_id: "all" },
      data: {},
    },
  };
}

// Client-side expression counting the entities that fall into a status bucket,
// used to show/hide the matching separator.
function stateCountExpression(domains: string[], bucket: "on" | "off"): string {
  const conditions = domains
    .flatMap((domain) =>
      (DOMAIN_STATE_BUCKETS[domain]?.[bucket] ?? []).map(
        (state) => `(s.entity_id.startsWith('${domain}.') && s.state === '${state}')`,
      ),
    )
    .join(" || ");

  return `Object.values(hass.states).filter(s => ${conditions || "false"}).length`;
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

// Security is presented as logical groups (alarm, locks, hazards, doors/windows
// split by open/closed, motion) rather than a raw active/clear split. Only groups
// that actually have entities are rendered.
function buildSecurityCards(hass: HomeAssistant, options: StrategyConfig, t: Translator): LovelaceCard[] {
  const cards: LovelaceCard[] = [];
  const showAlarmControls = options.show_alarm_controls ?? DEFAULT_SHOW_ALARM_CONTROLS;

  const alarms = entityIdsForDomain(hass, "alarm_control_panel");
  if (alarms.length) {
    cards.push(bubbleSeparator(t("alarm"), "mdi:shield-home"));
    cards.push({
      type: "grid",
      square: false,
      columns: 1,
      cards: alarms.map((entityId) => buildAlarmCard(entityId, showAlarmControls, t)),
    });
  }

  const locks = entityIdsForDomain(hass, "lock");
  if (locks.length) {
    cards.push(bubbleSeparator(t("locks"), "mdi:lock"));
    cards.push({
      type: "grid",
      square: false,
      columns: 2,
      cards: locks.map((entityId) => buildLockCard(entityId, t)),
    });
  }

  if (hasBinarySensorClass(hass, SECURITY_HAZARD_CLASSES)) {
    cards.push(bubbleSeparator(t("smokeAndLeaks"), "mdi:smoke-detector"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_HAZARD_CLASSES) }));
  }

  if (hasBinarySensorClass(hass, SECURITY_OPENING_CLASSES)) {
    cards.push(bubbleSeparator(t("doorsWindowsOpen"), "mdi:door-open"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_OPENING_CLASSES, "on") }));
    cards.push(bubbleSeparator(t("doorsWindowsClosed"), "mdi:door-closed"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_OPENING_CLASSES, "off") }));
  }

  if (hasBinarySensorClass(hass, SECURITY_MOTION_CLASSES)) {
    cards.push(bubbleSeparator(t("motionAndPresence"), "mdi:motion-sensor"));
    cards.push(autoEntitiesGrid({ columns: 2, include: securityClassIncludes(SECURITY_MOTION_CLASSES) }));
  }

  return cards;
}

// Alarm panels render as a taller, interactive card: state on the main button
// plus arm/disarm controls (which can be hidden from the editor).
function buildAlarmCard(entityId: string, showControls: boolean, t: Translator): LovelaceCard {
  const card: LovelaceCard = {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "state",
    entity: entityId,
    rows: DESIGN.cardRows.alarm,
  };

  if (showControls) {
    card.sub_button = [
      alarmControl(t("armAway"), "mdi:shield-lock", "alarm_control_panel.alarm_arm_away", entityId),
      alarmControl(t("armHome"), "mdi:shield-home", "alarm_control_panel.alarm_arm_home", entityId),
      alarmControl(t("disarm"), "mdi:shield-off", "alarm_control_panel.alarm_disarm", entityId),
    ];
  }

  return card;
}

function alarmControl(name: string, icon: string, service: string, entityId: string): LovelaceCard {
  return {
    name,
    icon,
    show_name: true,
    show_icon: true,
    show_background: true,
    tap_action: {
      action: "call-service",
      service,
      target: { entity_id: entityId },
      data: {},
    },
  };
}

// Locks render with explicit unlock/lock controls instead of a plain toggle.
function buildLockCard(entityId: string, t: Translator): LovelaceCard {
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "state",
    entity: entityId,
    sub_button: [
      lockControl(t("unlock"), "mdi:lock-open-variant", "lock.unlock", entityId),
      lockControl(t("lock"), "mdi:lock", "lock.lock", entityId),
    ],
  };
}

function lockControl(name: string, icon: string, service: string, entityId: string): LovelaceCard {
  return {
    name,
    icon,
    show_name: true,
    show_icon: true,
    show_background: true,
    tap_action: {
      action: "call-service",
      service,
      target: { entity_id: entityId },
      data: {},
    },
  };
}

function entityIdsForDomain(hass: HomeAssistant, domain: string): string[] {
  return Object.keys(hass.states)
    .filter((entityId) => getDomain(entityId) === domain)
    .sort();
}

function securityClassIncludes(deviceClasses: string[], state?: string): AutoEntitiesFilter[] {
  return deviceClasses.map((deviceClass) => ({
    domain: "binary_sensor",
    attributes: { device_class: deviceClass },
    ...(state ? { state } : {}),
    options: SECURITY_BUTTON_TEMPLATE,
  }));
}

function hasBinarySensorClass(hass: HomeAssistant, deviceClasses: string[]): boolean {
  return Object.values(hass.states).some(
    (state) =>
      getDomain(state.entity_id) === "binary_sensor" &&
      deviceClasses.includes(String(state.attributes.device_class ?? "")),
  );
}

// --- Batteries ----------------------------------------------------------------

function buildBatteryCards(options: StrategyConfig, t: Translator): LovelaceCard[] {
  const template = { type: "custom:bubble-card", card_type: "button", button_type: "state" };
  const threshold = options.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
  const hideMobile = options.hide_mobile_app_batteries ?? DEFAULT_HIDE_MOBILE_APP_BATTERIES;
  const exclude = hideMobile ? [{ integration: "mobile_app" }] : undefined;
  const sort = { method: "state", numeric: true };

  const batteryInclude = (state: string): AutoEntitiesFilter[] => [
    { domain: "sensor", attributes: { device_class: "battery" }, state, options: template },
  ];

  return [
    bubbleSeparator(t("critical"), "mdi:battery-alert"),
    autoEntitiesGrid({ columns: 2, include: batteryInclude(`< ${threshold}`), exclude, sort }),
    bubbleSeparator(t("ok"), "mdi:battery"),
    autoEntitiesGrid({ columns: 2, include: batteryInclude(`>= ${threshold}`), exclude, sort }),
  ];
}
