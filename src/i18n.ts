import type { HomeAssistant } from "./types";

export type Language = "de" | "en";

// Dashboard-facing strings. Room, device and area names come already localized
// from Home Assistant, so only the generated labels live here.
const STRINGS = {
  en: {
    lights: "Lights",
    security: "Security",
    climate: "Climate",
    batteries: "Batteries",
    media: "Media",
    covers: "Covers",
    scenes: "Scenes",
    devices: "Devices",
    rooms: "Rooms",
    cameras: "Cameras",
    on: "On",
    off: "Off",
    allOn: "All on",
    allOff: "All off",
    alarm: "Alarm",
    locks: "Locks",
    lock: "Lock",
    unlock: "Unlock",
    smokeAndLeaks: "Smoke & Leaks",
    doorsWindowsOpen: "Doors & Windows – Open",
    doorsWindowsClosed: "Doors & Windows – Closed",
    motionAndPresence: "Motion & Presence",
    critical: "Critical",
    low: "Low",
    ok: "OK",
    armAway: "Away",
    armHome: "Home",
    disarm: "Disarm",
    noEntities: "No visible entities found for this area.",
  },
  de: {
    lights: "Licht",
    security: "Sicherheit",
    climate: "Klima",
    batteries: "Batterien",
    media: "Medien",
    covers: "Rollos",
    scenes: "Szenen",
    devices: "Geräte",
    rooms: "Räume",
    cameras: "Kameras",
    on: "An",
    off: "Aus",
    allOn: "Alle an",
    allOff: "Alle aus",
    alarm: "Alarm",
    locks: "Schlösser",
    lock: "Abschließen",
    unlock: "Aufschließen",
    smokeAndLeaks: "Rauch & Lecks",
    doorsWindowsOpen: "Türen & Fenster – Offen",
    doorsWindowsClosed: "Türen & Fenster – Geschlossen",
    motionAndPresence: "Bewegung & Anwesenheit",
    critical: "Kritisch",
    low: "Niedrig",
    ok: "OK",
    armAway: "Abwesend",
    armHome: "Zuhause",
    disarm: "Entschärfen",
    noEntities: "Keine sichtbaren Entitäten für diesen Bereich.",
  },
} satisfies Record<Language, Record<string, string>>;

export type TranslationKey = keyof (typeof STRINGS)["en"];

/** Resolves the active dashboard language from Home Assistant, defaulting to English. */
export function getLanguage(hass: HomeAssistant): Language {
  const raw = (hass.language || hass.locale?.language || "en").toLowerCase();
  return raw.startsWith("de") ? "de" : "en";
}

export type Translator = (key: TranslationKey) => string;

/** Builds a translator bound to the current Home Assistant language. */
export function createTranslator(hass: HomeAssistant): Translator {
  const language = getLanguage(hass);
  return (key) => STRINGS[language][key] ?? STRINGS.en[key];
}
