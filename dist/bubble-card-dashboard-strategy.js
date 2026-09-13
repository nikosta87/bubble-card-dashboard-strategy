// src/constants.ts
var STRATEGY_TYPE = "bubble-card-dashboard";
var DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
var VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
var EDITOR_ELEMENT = "bubble-card-dashboard-strategy-editor";
var VERSION = "0.24.0";
var DEFAULT_MAX_ENTITIES_PER_AREA = 24;
var DEFAULT_ENABLE_ADVANCED_CONTROLS = true;
var DEFAULT_ROOM_ORDER = "alphabetical";
var DEFAULT_HIDE_MOBILE_APP_BATTERIES = true;
var DEFAULT_BATTERY_CRITICAL_BELOW = 20;
var DEFAULT_BATTERY_LOW_BELOW = 40;
var DEFAULT_SHOW_ALARM_CONTROLS = true;
var ROOMS_POPUP_HASH = "#rooms";
var DOMAIN_CARD_TYPES = {
  alarm_control_panel: "button",
  button: "button",
  climate: "climate",
  cover: "cover",
  fan: "button",
  humidifier: "button",
  input_boolean: "button",
  light: "button",
  lock: "button",
  media_player: "media-player",
  number: "button",
  scene: "button",
  script: "button",
  select: "select",
  input_number: "button",
  input_select: "select",
  switch: "button",
  vacuum: "button"
};
var DEFAULT_IGNORED_DOMAINS = /* @__PURE__ */ new Set([
  "automation",
  "camera",
  "device_tracker",
  "event",
  "group",
  "person",
  "sun",
  "update",
  "zone"
]);

// src/registry.ts
var CACHE_TTL_MS = 3e4;
var REGISTRY_EVENTS = [
  "area_registry_updated",
  "device_registry_updated",
  "entity_registry_updated"
];
var cache = null;
var subscribed = false;
async function getRegistries(hass, options = {}) {
  ensureInvalidationSubscription(hass);
  const now = Date.now();
  if (!options.force && cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.promise;
  }
  const promise = loadRegistries(hass);
  const entry = { timestamp: now, promise };
  cache = entry;
  try {
    return await promise;
  } catch (error) {
    if (cache === entry) {
      cache = null;
    }
    throw error;
  }
}
function invalidateRegistries() {
  cache = null;
}
async function loadRegistries(hass) {
  const [areas, devices, entities] = await Promise.all([
    hass.callWS({ type: "config/area_registry/list" }),
    hass.callWS({ type: "config/device_registry/list" }),
    hass.callWS({ type: "config/entity_registry/list" })
  ]);
  return { areas, devices, entities };
}
function ensureInvalidationSubscription(hass) {
  if (subscribed || !hass.connection?.subscribeEvents) {
    return;
  }
  subscribed = true;
  for (const eventType of REGISTRY_EVENTS) {
    hass.connection.subscribeEvents(() => invalidateRegistries(), eventType).catch(() => {
    });
  }
}

// src/utils/format.ts
function clampNumber(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// src/utils/entities.ts
function getDomain(entityId) {
  return entityId.split(".", 1)[0] || "";
}
function getActiveAreas(areas, entities, devices) {
  return areas.filter((area) => entities.some((entity) => entityBelongsToArea(entity, area.area_id, devices)));
}
function sortAreas(areas, order, customOrder) {
  if (order === "alphabetical") {
    return [...areas].sort((left, right) => left.name.localeCompare(right.name));
  }
  if (order === "custom") {
    const rank = (areaId) => {
      const index = customOrder.indexOf(areaId);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...areas].sort((left, right) => rank(left.area_id) - rank(right.area_id) || left.name.localeCompare(right.name));
  }
  return [...areas];
}
function orderAreas(areas, options) {
  const hidden = new Set(options.hidden_areas ?? []);
  const visible = areas.filter((area) => !hidden.has(area.area_id));
  return sortAreas(visible, options.room_order ?? DEFAULT_ROOM_ORDER, options.custom_room_order ?? []);
}
function entityBelongsToArea(entity, areaId, devices) {
  if (entity.area_id === areaId) {
    return true;
  }
  if (!entity.area_id && entity.device_id) {
    return devices.some((device) => device.id === entity.device_id && device.area_id === areaId && !device.disabled_by);
  }
  return false;
}
function getAreaEntities(areaId, entities, devices, hass, options) {
  const ignoredEntities = new Set(options.ignored_entities ?? []);
  const ignoredDomains = /* @__PURE__ */ new Set([...options.ignored_domains ?? [], ...DEFAULT_IGNORED_DOMAINS]);
  return entities.filter((entity) => entityBelongsToArea(entity, areaId, devices)).filter((entity) => entity.entity_id in hass.states).filter((entity) => !entity.hidden_by && !entity.disabled_by).filter((entity) => !ignoredEntities.has(entity.entity_id)).filter((entity) => !ignoredDomains.has(getDomain(entity.entity_id))).filter((entity) => DOMAIN_CARD_TYPES[getDomain(entity.entity_id)]).sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
}
function getVisibleAreaEntities(areaId, entities, devices, hass, options) {
  const ignoredEntities = new Set(options.ignored_entities ?? []);
  const ignoredDomains = new Set(options.ignored_domains ?? []);
  return entities.filter((entity) => entityBelongsToArea(entity, areaId, devices)).filter((entity) => entity.entity_id in hass.states).filter((entity) => !entity.hidden_by && !entity.disabled_by).filter((entity) => !ignoredEntities.has(entity.entity_id)).filter((entity) => !ignoredDomains.has(getDomain(entity.entity_id)));
}
function getFriendlyName(entity, hass) {
  const state = hass.states[entity.entity_id];
  const friendlyName = state?.attributes.friendly_name;
  return String(friendlyName || entity.name || entity.original_name || entity.entity_id);
}
function findStateEntities(hass, domains) {
  return Object.keys(hass.states).filter((entityId) => domains.includes(getDomain(entityId))).sort();
}
function findFirstStateEntity(hass, domains) {
  return findStateEntities(hass, domains)[0];
}
function findLastUsedMediaPlayer(hass) {
  const mediaPlayers = findStateEntities(hass, ["media_player"]);
  return mediaPlayers.map((entityId) => ({
    entityId,
    score: getMediaPlayerScore(hass, entityId)
  })).sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId))[0]?.entityId;
}
function getMediaPlayerScore(hass, entityId) {
  const state = hass.states[entityId];
  if (!state) {
    return 0;
  }
  const stateRank = {
    playing: 4,
    paused: 3,
    idle: 2,
    standby: 1,
    on: 1
  };
  const mediaMetadataBonus = hasMediaMetadata(state.attributes) ? 1e13 : 0;
  const stateBonus = (stateRank[state.state] || 0) * 1e14;
  const updatedAt = getMediaPlayerUpdatedAt(state);
  return stateBonus + mediaMetadataBonus + updatedAt;
}
function hasMediaMetadata(attributes) {
  return Boolean(
    attributes.media_title || attributes.media_artist || attributes.media_album_name || attributes.entity_picture || attributes.app_name
  );
}
function getMediaPlayerUpdatedAt(state) {
  const candidates = [
    state.attributes.media_position_updated_at,
    state.last_updated,
    state.last_changed
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }
  return 0;
}
function getUserInitial(hass) {
  return (hass.user?.name || "?").trim().slice(0, 1).toUpperCase() || "?";
}
function getRoomHash(area) {
  return `#room-${slugify(area.name || area.area_id)}`;
}

// src/editor.ts
var BOOLEAN_FIELDS = /* @__PURE__ */ new Set([
  "enable_advanced_controls",
  "show_light_summary",
  "show_security_summary",
  "show_climate_summary",
  "show_battery_summary",
  "show_alarm_controls",
  "hide_mobile_app_batteries",
  "ambient_room_colors",
  "artwork_media_surface",
  "contextual_home_cards"
]);
var STORAGE_KEY = "bcds-editor-expanded-panels";
var BubbleCardDashboardStrategyEditor = class extends HTMLElement {
  _config = {};
  _hass;
  _areas = [];
  _areasLoaded = false;
  _areasLoading = false;
  _rendered = false;
  _expanded = loadExpandedPanels();
  set hass(hass) {
    this._hass = hass;
    this.loadAreas();
    if (!this._rendered) this.render();
  }
  setConfig(config) {
    this._config = {
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      enable_advanced_controls: DEFAULT_ENABLE_ADVANCED_CONTROLS,
      room_order: DEFAULT_ROOM_ORDER,
      ...config
    };
    this.render();
  }
  connectedCallback() {
    this.render();
  }
  async loadAreas() {
    if (!this._hass || this._areasLoaded || this._areasLoading) return;
    this._areasLoading = true;
    try {
      const { areas, devices, entities } = await getRegistries(this._hass);
      this._areas = getActiveAreas(areas, entities, devices);
      this._areasLoaded = true;
      this.render();
    } catch {
    } finally {
      this._areasLoading = false;
    }
  }
  orderedAreasForDisplay() {
    return sortAreas(this._areas, this._config.room_order ?? DEFAULT_ROOM_ORDER, this._config.custom_room_order ?? []);
  }
  panel(key, icon, title, description, body) {
    const expanded = this._expanded.has(key);
    return `<section class="panel ${expanded ? "expanded" : "collapsed"}">
      <button class="panel-header" type="button" data-panel="${key}" aria-expanded="${expanded}">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="panel-heading"><strong>${title}</strong><small>${description}</small></span>
        <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${expanded ? `<div class="panel-body">${body}</div>` : ""}
    </section>`;
  }
  field(label, control, hint = "") {
    return `<div class="field"><label>${label}</label><div class="control">${control}${hint ? `<div class="hint">${hint}</div>` : ""}</div></div>`;
  }
  toggle(field, checked) {
    return `<label class="switch"><input data-field="${field}" type="checkbox" ${checked ? "checked" : ""}><span></span></label>`;
  }
  render() {
    this._rendered = true;
    const maxEntities = this._config.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
    const advanced = this._config.enable_advanced_controls ?? DEFAULT_ENABLE_ADVANCED_CONTROLS;
    const themeGrouping = this._config.theme_grouping ?? "auto";
    const roomOrder = this._config.room_order ?? DEFAULT_ROOM_ORDER;
    const hero = this._config.home_hero_mode ?? "adaptive";
    const intensity = this._config.visual_intensity ?? "balanced";
    const ambient = this._config.ambient_room_colors ?? true;
    const artwork = this._config.artwork_media_surface ?? true;
    const contextual = this._config.contextual_home_cards ?? true;
    const batteryCritical = this._config.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
    const batteryLow = this._config.battery_low_below ?? DEFAULT_BATTERY_LOW_BELOW;
    const appearance = [
      this.field("Visual intensity", `<select data-field="visual_intensity"><option value="subtle" ${intensity === "subtle" ? "selected" : ""}>Subtle</option><option value="balanced" ${intensity === "balanced" ? "selected" : ""}>Balanced</option><option value="vivid" ${intensity === "vivid" ? "selected" : ""}>Vivid</option></select>`, "Controls how strongly state colors tint room and active surfaces."),
      this.field("Ambient room colors", this.toggle("ambient_room_colors", ambient), "Blend the real color of active room lights into each room tile."),
      this.field("Media artwork surfaces", this.toggle("artwork_media_surface", artwork), "Use media artwork as the visual surface when supported by Bubble Card.")
    ].join("");
    const home = [
      this.field("Contextual hero", `<select data-field="home_hero_mode"><option value="adaptive" ${hero === "adaptive" ? "selected" : ""}>Adaptive</option><option value="media" ${hero === "media" ? "selected" : ""}>Media first</option><option value="weather" ${hero === "weather" ? "selected" : ""}>Weather first</option><option value="none" ${hero === "none" ? "selected" : ""}>None</option></select>`, "Adaptive prioritizes what deserves attention now instead of showing a fixed catalogue."),
      this.field("Hide inactive context cards", this.toggle("contextual_home_cards", contextual), "Keep Home calm: idle vacuums and inactive media stay out of the primary surface."),
      this.field("Profile image", `<input data-field="profile_image" type="text" value="${escapeHtml(this._config.profile_image || "")}" placeholder="/local/profile.jpg">`)
    ].join("");
    const rooms = [
      this.field("Max entities per room", `<input data-field="max_entities_per_area" type="number" min="1" max="100" value="${maxEntities}">`, "Complex controls are full width; simple actions use two columns."),
      this.field("Room order", `<select data-field="room_order">${roomOrderOption("home_assistant", "Home Assistant order", roomOrder)}${roomOrderOption("alphabetical", "Alphabetical", roomOrder)}${roomOrderOption("custom", "Custom", roomOrder)}</select>`),
      this.renderRoomList(roomOrder)
    ].join("");
    const summaries = [
      this.field("Lights", this.toggle("show_light_summary", this._config.show_light_summary ?? true)),
      this.field("Security", this.toggle("show_security_summary", this._config.show_security_summary ?? true)),
      this.field("Alarm controls", this.toggle("show_alarm_controls", this._config.show_alarm_controls ?? DEFAULT_SHOW_ALARM_CONTROLS)),
      this.field("Climate", this.toggle("show_climate_summary", this._config.show_climate_summary ?? true)),
      this.field("Batteries", this.toggle("show_battery_summary", this._config.show_battery_summary ?? true)),
      this.field("Hide mobile batteries", this.toggle("hide_mobile_app_batteries", this._config.hide_mobile_app_batteries ?? DEFAULT_HIDE_MOBILE_APP_BATTERIES)),
      this.field("Critical below", `<input data-field="battery_critical_below" type="number" min="1" max="100" value="${batteryCritical}">`),
      this.field("Low below", `<input data-field="battery_low_below" type="number" min="1" max="100" value="${batteryLow}">`),
      this.field("Group entities by", `<select data-field="theme_grouping">${themeGroupingOption("auto", "Automatic", themeGrouping)}${themeGroupingOption("area", "Room", themeGrouping)}${themeGroupingOption("state", "State", themeGrouping)}${themeGroupingOption("none", "No grouping", themeGrouping)}</select>`)
    ].join("");
    const advancedBody = [
      this.field("Advanced Bubble controls", this.toggle("enable_advanced_controls", advanced), "Enable capability-aware sliders/selects for compatible entities."),
      this.field("Dashboard title", `<input data-field="title" type="text" value="${escapeHtml(this._config.title || "")}" placeholder="${escapeHtml(this._hass?.config.location_name || "Bubble Card Dashboard")}">`, "Leave empty to use the Home Assistant location name.")
    ].join("");
    this.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color);font:inherit}.editor{display:grid;gap:12px;max-width:820px;margin:auto}.intro{padding:4px 4px 10px}.intro h2{margin:0 0 6px;font-size:20px}.intro p{margin:0;color:var(--secondary-text-color);line-height:1.45}
      .group-label{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color);margin:18px 4px 2px}.panel{border:1px solid var(--divider-color);border-radius:16px;background:var(--card-background-color);overflow:hidden}.panel-header{width:100%;display:flex;align-items:center;gap:14px;padding:16px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.panel-header>ha-icon:first-child{color:var(--primary-color)}.panel-heading{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.panel-heading small{font-weight:400;color:var(--secondary-text-color);white-space:normal}.chevron{transition:transform .18s ease}.expanded .chevron{transform:rotate(180deg)}.panel-body{padding:0 16px 16px;border-top:1px solid var(--divider-color)}
      .field{display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:20px;align-items:start;padding:15px 0;border-bottom:1px solid color-mix(in srgb,var(--divider-color) 65%,transparent)}.field:last-child{border-bottom:0}.field>label{font-weight:500;padding-top:9px}.control{min-width:0}.hint{font-size:12px;line-height:1.4;color:var(--secondary-text-color);margin-top:7px}input,select{width:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font:inherit;padding:10px 12px}
      .switch{display:inline-flex!important;padding:0!important}.switch input{position:absolute;opacity:0;width:1px}.switch span{width:44px;height:24px;border-radius:14px;background:var(--disabled-color);position:relative;transition:.18s}.switch span:after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:white;top:3px;left:3px;transition:.18s}.switch input:checked+span{background:var(--primary-color)}.switch input:checked+span:after{transform:translateX(20px)}
      .room-list{grid-column:1/-1;border:1px solid var(--divider-color);border-radius:12px;overflow:hidden;margin-top:8px}.room-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--divider-color)}.room-row:last-child{border:0}.room-row input{width:auto}.room-name{flex:1}.room-actions{display:flex;gap:6px}.room-actions button{width:34px;height:34px;border:1px solid var(--divider-color);border-radius:9px;background:var(--secondary-background-color);color:inherit}.room-empty{padding:12px;color:var(--secondary-text-color)}
      @media(max-width:640px){.field{grid-template-columns:1fr;gap:7px}.field>label{padding-top:0}.panel-header{padding:14px}.panel-heading small{font-size:12px}}
    </style><div class="editor"><div class="intro"><h2>Bubble Card Dashboard</h2><p>Adaptive Home Surface \u2014 configure what the household sees, not individual Home Assistant implementation details.</p></div>
      <div class="group-label">Experience</div>${this.panel("appearance", "mdi:palette-outline", "Appearance", "Color, ambience and visual personality", appearance)}${this.panel("home", "mdi:home-lightning-bolt-outline", "Home", "Contextual overview and navigation", home)}
      <div class="group-label">Spaces & controls</div>${this.panel("rooms", "mdi:floor-plan", "Rooms", "Room visibility, order and popup density", rooms)}${this.panel("summaries", "mdi:view-dashboard-outline", "Global controls", "Lights, security, climate and maintenance", summaries)}
      <div class="group-label">Advanced</div>${this.panel("advanced", "mdi:tune-variant", "Advanced", "Bubble controls and dashboard metadata", advancedBody)}
    </div>`;
    this.querySelectorAll("[data-panel]").forEach((el) => el.addEventListener("click", (event) => this.togglePanel(event.currentTarget.dataset.panel || "")));
    this.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("change", (event) => this.handleChange(event));
      el.addEventListener("input", (event) => this.handleInput(event));
    });
    this.querySelectorAll("[data-room-visible]").forEach((el) => el.addEventListener("change", (event) => this.handleRoomVisibility(event)));
    this.querySelectorAll("[data-room-move]").forEach((el) => el.addEventListener("click", (event) => this.handleRoomMove(event)));
  }
  togglePanel(key) {
    if (!key) return;
    this._expanded.has(key) ? this._expanded.delete(key) : this._expanded.add(key);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this._expanded]));
    } catch {
    }
    this.render();
  }
  renderRoomList(roomOrder) {
    if (!this._areasLoaded) return `<div class="room-list"><div class="room-empty">Loading rooms\u2026</div></div>`;
    if (!this._areas.length) return `<div class="room-list"><div class="room-empty">No rooms with entities found.</div></div>`;
    const hidden = new Set(this._config.hidden_areas ?? []);
    const ordered = this.orderedAreasForDisplay();
    return `<div class="room-list">${ordered.map((area, index) => `<div class="room-row"><input type="checkbox" data-room-visible="${escapeHtml(area.area_id)}" ${hidden.has(area.area_id) ? "" : "checked"}><span class="room-name">${escapeHtml(area.name)}</span>${roomOrder === "custom" ? `<span class="room-actions"><button type="button" data-room-move="up" data-area="${escapeHtml(area.area_id)}" ${index === 0 ? "disabled" : ""}>\u2191</button><button type="button" data-room-move="down" data-area="${escapeHtml(area.area_id)}" ${index === ordered.length - 1 ? "disabled" : ""}>\u2193</button></span>` : ""}</div>`).join("")}</div>`;
  }
  handleInput(event) {
    const target = event.target;
    if (target.dataset.field === "title" || target.dataset.field === "profile_image") this.updateConfig(target.dataset.field, target.value || void 0);
  }
  handleChange(event) {
    const target = event.target;
    const field = target.dataset.field;
    if (!field || field === "title" || field === "profile_image") return;
    if (field === "max_entities_per_area" || field === "battery_critical_below" || field === "battery_low_below") {
      this.updateConfig(field, clampNumber(Number(target.value), 1, 100));
      return;
    }
    if (BOOLEAN_FIELDS.has(field)) {
      this.updateConfig(field, target.checked);
      return;
    }
    if (field === "room_order") {
      this.updateConfig(field, target.value);
      this.render();
      return;
    }
    if (field === "theme_grouping") {
      this.updateConfig(field, target.value === "auto" ? void 0 : target.value);
      return;
    }
    this.updateConfig(field, target.value);
  }
  handleRoomVisibility(event) {
    const target = event.target;
    const id = target.dataset.roomVisible;
    if (!id) return;
    const hidden = new Set(this._config.hidden_areas ?? []);
    target.checked ? hidden.delete(id) : hidden.add(id);
    const list = [...hidden];
    this.updateConfig("hidden_areas", list.length ? list : void 0);
  }
  handleRoomMove(event) {
    const target = event.currentTarget;
    const id = target.dataset.area;
    const dir = target.dataset.roomMove;
    if (!id || dir !== "up" && dir !== "down") return;
    const order = this.orderedAreasForDisplay().map((a) => a.area_id);
    const i = order.indexOf(id);
    const j = dir === "up" ? i - 1 : i + 1;
    if (i === -1 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    this.updateConfig("custom_room_order", order);
    this.render();
  }
  updateConfig(field, value) {
    const next = { ...this._config, [field]: value };
    if (value === void 0 || value === "") delete next[field];
    this._config = next;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
  }
};
function loadExpandedPanels() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) return new Set(parsed.filter((v) => typeof v === "string"));
  } catch {
  }
  return /* @__PURE__ */ new Set(["appearance", "home"]);
}
function themeGroupingOption(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}
function roomOrderOption(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

// src/design.ts
var DESIGN = {
  popup: { widthDesktop: "540px", bgOpacity: "92", bgBlur: "14" },
  cardLayout: { alarm: "large-2-rows", lock: "large-2-rows" }
};
var THEME_TOKENS = {
  "--bcds-accent": "var(--primary-color)",
  "--bcds-radius": "var(--ha-card-border-radius, 22px)",
  "--bcds-surface": "var(--ha-card-background, var(--card-background-color))",
  "--bcds-positive": "var(--success-color, #43a047)",
  "--bcds-warning": "var(--warning-color, #ffa000)",
  "--bcds-critical": "var(--error-color, #db4437)"
};
var BUBBLE_BINDINGS = {
  "--bubble-accent-color": "var(--bcds-accent)",
  "--bubble-border-radius": "var(--bcds-radius)"
};
function bubbleThemeStyles() {
  const declarations = [...Object.entries(THEME_TOKENS), ...Object.entries(BUBBLE_BINDINGS)].map(([name, value]) => `  ${name}: ${value};`).join("\n");
  return `ha-card {
${declarations}
}`;
}
function bubbleLightSurfaceStyles() {
  return `
    \${(() => {
      if (!entity || !entity.startsWith('light.')) return '';
      const stateObj = hass.states[entity];
      const attrs = stateObj?.attributes || {};
      const clear = () => {
        card.style.removeProperty('--bubble-button-main-background-color');
        card.style.removeProperty('--bubble-button-icon-background-color');
      };
      if (!stateObj || stateObj.state !== 'on') { clear(); return ''; }
      let rgb = Array.isArray(attrs.rgb_color) ? attrs.rgb_color.slice(0, 3).map(Number) : null;
      let kelvin = Number(attrs.color_temp_kelvin || 0);
      if (!kelvin && Number(attrs.color_temp || 0) > 0) kelvin = 1000000 / Number(attrs.color_temp);
      if (!rgb && kelvin > 0) {
        const temp = Math.max(10, Math.min(400, kelvin / 100));
        const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
        let red, green, blue;
        if (temp <= 66) {
          red = 255; green = 99.4708025861 * Math.log(temp) - 161.1195681661;
          blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
        } else {
          red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
          green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492); blue = 255;
        }
        rgb = [clamp(red), clamp(green), clamp(blue)];
      }
      if (!rgb || rgb.some((value) => !Number.isFinite(value))) { clear(); return ''; }
      const brightness = Math.max(0, Math.min(255, Number(attrs.brightness ?? 180))) / 255;
      const surfaceAlpha = (0.11 + brightness * 0.14).toFixed(3);
      const iconAlpha = (0.22 + brightness * 0.18).toFixed(3);
      const color = rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))));
      card.style.setProperty('--bubble-button-main-background-color', 'rgba(' + color.join(',') + ',' + surfaceAlpha + ')');
      card.style.setProperty('--bubble-button-icon-background-color', 'rgba(' + color.join(',') + ',' + iconAlpha + ')');
      return '';
    })()}
  `;
}
function bubbleRoomAmbientStyles(lightEntityIds, intensity = "balanced") {
  const ids = JSON.stringify(lightEntityIds);
  const alpha = intensity === "subtle" ? 0.12 : intensity === "vivid" ? 0.28 : 0.2;
  return `
    \${(() => {
      const ids = ${ids};
      const active = ids.map(id => hass.states[id]).filter(s => s?.state === 'on');
      if (!active.length) {
        card.style.removeProperty('--bubble-button-main-background-color');
        card.style.removeProperty('--bubble-button-icon-background-color');
        return '';
      }
      const toRgb = (s) => {
        const a = s.attributes || {};
        if (Array.isArray(a.rgb_color)) return a.rgb_color.slice(0, 3).map(Number);
        let k = Number(a.color_temp_kelvin || 0);
        if (!k && Number(a.color_temp || 0) > 0) k = 1000000 / Number(a.color_temp);
        if (!k) return [255, 193, 110];
        const t = Math.max(10, Math.min(400, k / 100));
        const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
        let r, g, b;
        if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
        else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
        return [clamp(r), clamp(g), clamp(b)];
      };
      const colors = active.map(toRgb);
      const rgb = [0,1,2].map(i => Math.round(colors.reduce((sum,c) => sum + c[i], 0) / colors.length));
      card.style.setProperty('--bubble-button-main-background-color', 'rgba(' + rgb.join(',') + ',${alpha})');
      card.style.setProperty('--bubble-button-icon-background-color', 'rgba(' + rgb.join(',') + ',${Math.min(alpha + 0.12, 0.45)})');
      return '';
    })()}
  `;
}

// src/cards/common.ts
function bubblePopup(config) {
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
    full_width_on_mobile: true,
    width_desktop: DESIGN.popup.widthDesktop,
    bg_opacity: DESIGN.popup.bgOpacity,
    bg_blur: DESIGN.popup.bgBlur,
    show_previous_button: config.showPreviousButton ?? false,
    close_by_clicking_outside: true,
    styles: bubbleThemeStyles(),
    cards: config.cards
  };
}
function bubbleSeparator(name, icon) {
  return { type: "custom:bubble-card", card_type: "separator", name, icon };
}
function buildFooter(areas, roomsLabel = "Rooms") {
  const group = [
    {
      name: roomsLabel,
      icon: "mdi:floor-plan",
      show_name: true,
      fill_width: true,
      tap_action: { action: "navigate", navigation_path: ROOMS_POPUP_HASH }
    },
    ...areas.slice(0, 4).map((area) => ({
      name: area.name,
      icon: area.icon || "mdi:home-outline",
      show_name: false,
      fill_width: true,
      tap_action: { action: "navigate", navigation_path: getRoomHash(area) }
    }))
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
      bottom: [{ name: "Navigation", buttons_layout: "inline", justify_content: "fill", group }]
    }
  };
}

// src/cards/media-player.ts
function mediaPlayerToCard(entityId, options) {
  const advanced = options.enable_advanced_controls ?? DEFAULT_ENABLE_ADVANCED_CONTROLS;
  const artwork = options.artwork_media_surface ?? true;
  return {
    type: "custom:bubble-card",
    card_type: "media-player",
    entity: entityId,
    show_state: true,
    // Bubble Card's cover surface is deliberately the visual hero: artwork gives
    // active media its own identity while the rest of Home remains calm.
    cover_background: artwork,
    main_buttons_position: "bottom",
    main_buttons_full_width: true,
    hide: { previous_button: true, next_button: true },
    ...advanced ? {
      card_layout: "large",
      rows: 2,
      sub_button: {
        main: [],
        bottom: [{
          buttons_layout: "inline",
          justify_content: "fill",
          group: [{
            entity: entityId,
            sub_button_type: "slider",
            always_visible: true,
            show_button_info: true,
            slider_value_position: "right",
            fill_width: true,
            hide_when_parent_unavailable: true
          }]
        }]
      }
    } : {}
  };
}

// src/cards/entity-cards.ts
function groupRoomEntities(entities) {
  const groupDefinitions = [
    { titleKey: "lights", icon: "mdi:lightbulb-group", domains: ["light"] },
    { titleKey: "climate", icon: "mdi:thermostat", domains: ["climate", "fan", "humidifier"] },
    { titleKey: "media", icon: "mdi:speaker", domains: ["media_player"] },
    { titleKey: "covers", icon: "mdi:window-shutter", domains: ["cover"] },
    { titleKey: "scenes", icon: "mdi:palette", domains: ["scene", "script", "button"] },
    { titleKey: "devices", icon: "mdi:power-plug", domains: ["alarm_control_panel", "input_boolean", "input_number", "input_select", "lock", "number", "select", "switch", "vacuum"] }
  ];
  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id)))
  }));
}
function getEntityPresentation(entity, options, hass) {
  const domain = getDomain(entity.entity_id);
  if (["media_player", "climate", "cover", "vacuum", "alarm_control_panel", "lock"].includes(domain)) {
    return "wide";
  }
  if (["select", "input_select"].includes(domain)) return "wide";
  if (["number", "input_number", "fan", "humidifier"].includes(domain)) {
    return useAdvancedControls(options) ? "wide" : "compact";
  }
  if (domain === "light") {
    if (!useAdvancedControls(options)) return "compact";
    const attributes = hass?.states[entity.entity_id]?.attributes ?? {};
    const colorModes = Array.isArray(attributes.supported_color_modes) ? attributes.supported_color_modes.map(String) : [];
    const hasRichLightControls = attributes.brightness !== void 0 || attributes.min_color_temp_kelvin !== void 0 || attributes.max_color_temp_kelvin !== void 0 || colorModes.some((mode) => mode !== "onoff");
    return hasRichLightControls || !hass ? "wide" : "compact";
  }
  return "compact";
}
function entityCardTemplate(domain, options = {}) {
  if (domain === "media_player") return { type: "custom:bubble-card", card_type: "media-player" };
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    const useSlider = useAdvancedControls(options) && ["light", "fan", "number", "input_number"].includes(domain);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: useSlider ? "slider" : ["scene", "script", "button"].includes(domain) ? "name" : "switch",
      ...domain === "light" ? { use_accent_color: false, styles: bubbleLightSurfaceStyles() } : {},
      ...useSlider ? { slider_value_position: "right" } : {}
    };
  }
  return bubbleDomainCard(cardType, domain, void 0, options);
}
function entityToCard(entity, options, hass) {
  const domain = getDomain(entity.entity_id);
  if (domain === "media_player") return mediaPlayerToCard(entity.entity_id, options);
  if (domain === "light") return lightToCard(entity.entity_id, options, hass);
  return entityToBubbleCard(entity, options, hass);
}
function lightToCard(entityId, options, hass) {
  if (!useAdvancedControls(options)) {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: "switch",
      entity: entityId,
      use_accent_color: false,
      styles: bubbleLightSurfaceStyles()
    };
  }
  const attributes = hass?.states[entityId]?.attributes ?? {};
  const colorModes = Array.isArray(attributes.supported_color_modes) ? attributes.supported_color_modes.map(String) : [];
  const supportsBrightness = attributes.brightness !== void 0 || colorModes.some((mode) => mode !== "onoff");
  const supportsTemperature = attributes.min_color_temp_kelvin !== void 0 || attributes.max_color_temp_kelvin !== void 0 || colorModes.includes("color_temp");
  const supportsColor = colorModes.some((mode) => ["hs", "xy", "rgb", "rgbw", "rgbww"].includes(mode));
  const controls = [];
  if (supportsBrightness || !hass) {
    controls.push({
      entity: entityId,
      sub_button_type: "slider",
      icon: "mdi:brightness-6",
      always_visible: true,
      show_background: false,
      light_background: true,
      hide_when_parent_unavailable: true,
      fill_width: true
    });
  }
  if (supportsTemperature) {
    controls.push({
      entity: entityId,
      icon: "mdi:thermometer",
      show_background: true,
      state_background: false,
      light_background: true,
      fill_width: false,
      hide_when_parent_unavailable: true,
      tap_action: { action: "more-info" }
    });
  }
  if (supportsColor) {
    controls.push({
      entity: entityId,
      icon: "mdi:palette",
      show_background: true,
      state_background: false,
      light_background: true,
      fill_width: false,
      hide_when_parent_unavailable: true,
      tap_action: { action: "more-info" }
    });
  }
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "switch",
    entity: entityId,
    use_accent_color: false,
    styles: bubbleLightSurfaceStyles(),
    ...controls.length ? {
      card_layout: "large",
      rows: 2,
      sub_button: {
        main: [],
        bottom: [{ buttons_layout: "inline", justify_content: "fill", group: controls.slice(0, 3) }]
      }
    } : {}
  };
}
function entityToBubbleCard(entity, options, hass) {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    const useSlider = useAdvancedControls(options) && ["fan", "number", "input_number"].includes(domain);
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: useSlider ? "slider" : ["scene", "script", "button"].includes(domain) ? "name" : "switch",
      ...useSlider ? { slider_value_position: "right" } : {}
    };
  }
  return bubbleDomainCard(cardType, domain, entity.entity_id, options, hass);
}
function bubbleDomainCard(cardType, domain, entityId, options, hass) {
  const advanced = Boolean(entityId && useAdvancedControls(options));
  if (domain === "cover" && entityId) {
    const supportedFeatures = Number(hass?.states[entityId]?.attributes.supported_features ?? 0);
    const supportsPosition = Boolean(supportedFeatures & 4);
    const supportsTiltSlider = Boolean(supportedFeatures & 128);
    const sliders = [];
    if (advanced && supportsPosition) {
      sliders.push({ entity: entityId, sub_button_type: "slider", icon: "mdi:arrow-up-down", show_background: false, state_background: false, use_accent_color: true, fill_width: true, hide_when_parent_unavailable: true });
    }
    if (advanced && supportsTiltSlider) {
      sliders.push({ entity: entityId, sub_button_type: "slider", icon: "mdi:angle-acute", cover_slider_type: "tilt_position", show_background: false, state_background: false, use_accent_color: true, fill_width: true, hide_when_parent_unavailable: true });
    }
    return {
      type: "custom:bubble-card",
      card_type: "cover",
      entity: entityId,
      main_buttons_position: "bottom",
      main_buttons_full_width: true,
      tilt_buttons: supportsTiltSlider ? "hidden" : "bottom",
      ...sliders.length ? { card_layout: "large", rows: 2, sub_button: { main: [], bottom: [{ buttons_layout: "inline", justify_content: "fill", group: sliders }] } } : {}
    };
  }
  return {
    type: "custom:bubble-card",
    card_type: cardType,
    ...entityId ? { entity: entityId } : {},
    ...advanced && domain === "climate" ? {
      state_color: true,
      main_buttons_position: "bottom",
      main_buttons_full_width: true,
      sub_button: {
        main: [{
          buttons_layout: "inline",
          group: [{
            entity: entityId,
            sub_button_type: "select",
            select_attribute: "hvac_modes",
            show_state: true,
            show_arrow: false,
            show_background: false,
            fill_width: false,
            hide_when_parent_unavailable: true
          }]
        }],
        bottom: []
      },
      card_layout: "large",
      rows: 2
    } : {}
  };
}
function useAdvancedControls(options) {
  return options.enable_advanced_controls ?? DEFAULT_ENABLE_ADVANCED_CONTROLS;
}

// src/views/area-view.ts
function buildAreaView(area, entities, devices, hass, options) {
  const cards = getAreaEntities(area.area_id, entities, devices, hass, options).slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA).map((entity) => entityToCard(entity, options, hass));
  return {
    type: "sections",
    max_columns: 3,
    sections: [
      {
        type: "grid",
        cards: [
          bubbleSeparator(area.name, area.icon || "mdi:home-outline"),
          cards.length ? {
            type: "grid",
            square: false,
            columns: 2,
            cards
          } : {
            type: "markdown",
            content: "No visible entities found for this area."
          },
          buildFooter([])
        ]
      }
    ]
  };
}

// src/cards/navigation.ts
function buildTopNavigation(hass, options) {
  return {
    type: "horizontal-stack",
    cards: [
      subButtonBar([profileSubButton(hass, options)], "flex-start"),
      subButtonBar([], "center"),
      subButtonBar([navigationSubButton("", "mdi:cog", "/config/dashboard")], "flex-end")
    ]
  };
}
function subButtonBar(group, justifyContent) {
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
          group
        }
      ]
    }
  };
}
function profileSubButton(hass, options) {
  const image = options.profile_image;
  return {
    name: getUserInitial(hass),
    icon: image ? void 0 : "mdi:account",
    image,
    show_name: !image,
    show_icon: !image,
    fill_width: false,
    tap_action: {
      action: "none"
    }
  };
}
function navigationSubButton(name, icon, navigationPath) {
  return {
    name,
    icon,
    show_name: Boolean(name),
    fill_width: false,
    tap_action: {
      action: "navigate",
      navigation_path: navigationPath
    }
  };
}

// src/cards/room-cards.ts
function buildSmartRoomCards(areas, entities, devices, hass, options) {
  return areas.map((area) => smartRoomCard(area, entities, devices, hass, options));
}
function smartRoomCard(area, entities, devices, hass, options) {
  const areaEntities = getVisibleAreaEntities(area.area_id, entities, devices, hass, options);
  const lightIds = areaEntities.filter((entity) => getDomain(entity.entity_id) === "light").map((entity) => entity.entity_id);
  const statusEntities = findRoomStatusEntities(areaEntities, hass);
  const ambient = options.ambient_room_colors ?? true;
  const intensity = options.visual_intensity ?? "balanced";
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    ...ambient && lightIds.length ? { styles: bubbleRoomAmbientStyles(lightIds, intensity) } : {},
    card_layout: "large",
    rows: 2,
    show_name: true,
    show_state: false,
    button_action: { tap_action: { action: "navigate", navigation_path: getRoomHash(area) } },
    ...statusEntities.length ? {
      sub_button: {
        main: [],
        bottom: [{ buttons_layout: "inline", justify_content: "start", group: statusEntities.map(roomStatusSubButton) }]
      }
    } : {}
  };
}
function findRoomStatusEntities(entities, hass) {
  const findByDeviceClass = (domain, deviceClasses) => entities.find((entity) => {
    const state = hass.states[entity.entity_id];
    return getDomain(entity.entity_id) === domain && deviceClasses.includes(String(state?.attributes.device_class || ""));
  });
  const lights = entities.filter((entity) => getDomain(entity.entity_id) === "light");
  const candidates = [
    findByDeviceClass("sensor", ["temperature"]),
    findByDeviceClass("binary_sensor", ["door", "window", "opening"]),
    findByDeviceClass("binary_sensor", ["occupancy", "presence", "motion"]),
    lights[0]
  ];
  return candidates.filter((entity) => Boolean(entity)).slice(0, 2);
}
function roomStatusSubButton(entity) {
  const domain = getDomain(entity.entity_id);
  return {
    entity: entity.entity_id,
    show_state: domain === "sensor" || domain === "binary_sensor",
    show_name: false,
    show_background: true,
    state_background: domain !== "sensor",
    light_background: domain === "light",
    fill_width: false,
    tap_action: { action: domain === "light" ? "toggle" : "more-info" }
  };
}

// src/i18n.ts
var STRINGS = {
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
    on: "On",
    off: "Off",
    allOn: "All on",
    allOff: "All off",
    alarm: "Alarm",
    locks: "Locks",
    lock: "Lock",
    unlock: "Unlock",
    smokeAndLeaks: "Smoke & Leaks",
    doorsWindowsOpen: "Doors & Windows \u2013 Open",
    doorsWindowsClosed: "Doors & Windows \u2013 Closed",
    motionAndPresence: "Motion & Presence",
    critical: "Critical",
    low: "Low",
    ok: "OK",
    armAway: "Away",
    armHome: "Home",
    disarm: "Disarm",
    noEntities: "No visible entities found for this area."
  },
  de: {
    lights: "Licht",
    security: "Sicherheit",
    climate: "Klima",
    batteries: "Batterien",
    media: "Medien",
    covers: "Rollos",
    scenes: "Szenen",
    devices: "Ger\xE4te",
    rooms: "R\xE4ume",
    on: "An",
    off: "Aus",
    allOn: "Alle an",
    allOff: "Alle aus",
    alarm: "Alarm",
    locks: "Schl\xF6sser",
    lock: "Abschlie\xDFen",
    unlock: "Aufschlie\xDFen",
    smokeAndLeaks: "Rauch & Lecks",
    doorsWindowsOpen: "T\xFCren & Fenster \u2013 Offen",
    doorsWindowsClosed: "T\xFCren & Fenster \u2013 Geschlossen",
    motionAndPresence: "Bewegung & Anwesenheit",
    critical: "Kritisch",
    low: "Niedrig",
    ok: "OK",
    armAway: "Abwesend",
    armHome: "Zuhause",
    disarm: "Entsch\xE4rfen",
    noEntities: "Keine sichtbaren Entit\xE4ten f\xFCr diesen Bereich."
  }
};
function getLanguage(hass) {
  const raw = (hass.language || hass.locale?.language || "en").toLowerCase();
  return raw.startsWith("de") ? "de" : "en";
}
function createTranslator(hass) {
  const language = getLanguage(hass);
  return (key) => STRINGS[language][key] ?? STRINGS.en[key];
}

// src/cards/auto-entities.ts
function autoEntitiesGrid(config) {
  return {
    type: "custom:auto-entities",
    card: {
      type: "grid",
      square: false,
      columns: config.columns
    },
    card_param: "cards",
    show_empty: false,
    filter: {
      include: config.include,
      ...config.exclude ? { exclude: config.exclude } : {}
    },
    sort: config.sort ?? { method: "friendly_name" }
  };
}

// src/views/summaries.ts
var DOMAIN_STATE_BUCKETS = {
  light: { on: ["on"], off: ["off"] },
  climate: { on: ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"], off: ["off"] },
  fan: { on: ["on"], off: ["off"] },
  humidifier: { on: ["on"], off: ["off"] }
};
var SECURITY_DEVICE_CLASSES = [
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
  "sound"
];
var SUMMARIES = [
  {
    kind: "domain",
    id: "lights",
    title: "Lights",
    icon: "mdi:lightbulb-group",
    configKey: "show_light_summary",
    domains: ["light"],
    columns: 2,
    defaultGrouping: "state"
  },
  {
    kind: "security",
    id: "security",
    title: "Security",
    icon: "mdi:shield-home",
    configKey: "show_security_summary"
  },
  {
    kind: "domain",
    id: "climate",
    title: "Climate",
    icon: "mdi:thermostat",
    configKey: "show_climate_summary",
    domains: ["climate", "fan", "humidifier"],
    columns: 2,
    defaultGrouping: "area"
  },
  {
    kind: "battery",
    id: "batteries",
    title: "Batteries",
    icon: "mdi:battery-50",
    configKey: "show_battery_summary"
  }
];
function getActiveSummaries(areas, entities, devices, hass, options) {
  return SUMMARIES.filter((summary) => isSummaryEnabled(summary, options)).map((summary) => ({ ...summary, entries: resolveEntries(summary, areas, entities, devices, hass, options) })).filter((summary) => summaryHasContent(summary, hass));
}
function isSummaryEnabled(summary, options) {
  const value = options[summary.configKey];
  return value === void 0 ? true : Boolean(value);
}
function resolveEntries(summary, areas, entities, devices, hass, options) {
  if (summary.kind !== "domain") {
    return [];
  }
  const entries = [];
  areas.forEach((area) => {
    getAreaEntities(area.area_id, entities, devices, hass, options).filter((entity) => summary.domains.includes(getDomain(entity.entity_id))).forEach((entity) => entries.push({ area, entity }));
  });
  return entries;
}
function summaryHasContent(summary, hass) {
  if (summary.kind === "domain") {
    return summary.entries.length > 0;
  }
  const predicate = summary.kind === "security" ? isSecurityState : isBatteryState;
  return Object.values(hass.states).some(predicate);
}
function isSecurityState(state) {
  const domain = getDomain(state.entity_id);
  if (domain === "lock" || domain === "alarm_control_panel") {
    return true;
  }
  if (domain === "binary_sensor") {
    return SECURITY_DEVICE_CLASSES.includes(String(state.attributes.device_class ?? ""));
  }
  return false;
}
function isBatteryState(state) {
  return getDomain(state.entity_id) === "sensor" && state.attributes.device_class === "battery";
}
function buildSummaryNavigation(summaries, t) {
  return {
    type: "custom:bubble-card",
    card_type: "sub-buttons",
    hide_main_background: true,
    rows: 0.941,
    sub_button: {
      main: [],
      bottom: [
        {
          name: "Summaries",
          buttons_layout: "inline",
          justify_content: "center",
          group: summaries.map((summary) => ({
            name: t(summary.id),
            icon: summary.icon,
            show_name: true,
            fill_width: false,
            tap_action: {
              action: "navigate",
              navigation_path: `#${summary.id}`
            }
          }))
        }
      ]
    }
  };
}
function buildSummaryPopups(summaries, hass, options, t) {
  return summaries.map((summary) => buildSummaryPopup(summary, hass, options, t));
}
function buildSummaryPopup(summary, hass, options, t) {
  const cards = buildSummaryCards(summary, hass, options, t);
  return bubblePopup({
    hash: `#${summary.id}`,
    name: t(summary.id),
    icon: summary.icon,
    cards
  });
}
function buildSummaryCards(summary, hass, options, t) {
  if (summary.kind !== "domain") {
    return summary.kind === "security" ? buildSecurityCards(hass, options, t) : buildBatteryCards(options, t);
  }
  const grouping = options.theme_grouping ?? summary.defaultGrouping;
  return grouping === "state" ? buildStateGroupedCards(summary, options, t) : buildStaticGroupedCards(summary, grouping, hass, options);
}
function buildStateGroupedCards(summary, options, t) {
  const isLights = summary.domains.includes("light");
  return [
    stateSeparator(
      t("on"),
      "mdi:toggle-switch",
      stateCountExpression(summary.domains, "on"),
      isLights ? masterSubButton(t("allOff"), "mdi:lightbulb-off", "light.turn_off") : void 0
    ),
    autoEntitiesGrid({ columns: summary.columns, include: buildStateIncludes(summary.domains, "on", options) }),
    stateSeparator(
      t("off"),
      "mdi:toggle-switch-off-outline",
      stateCountExpression(summary.domains, "off"),
      isLights ? masterSubButton(t("allOn"), "mdi:lightbulb-on", "light.turn_on") : void 0
    ),
    autoEntitiesGrid({ columns: summary.columns, include: buildStateIncludes(summary.domains, "off", options) })
  ];
}
function stateSeparator(name, icon, countExpression, master) {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon,
    styles: `\${card.style.display = (${countExpression} > 0) ? '' : 'none'}`,
    ...master ? { sub_button: [master] } : {}
  };
}
function masterSubButton(name, icon, service) {
  return {
    name,
    icon,
    show_name: true,
    show_icon: true,
    show_background: true,
    tap_action: {
      action: "perform-action",
      perform_action: service,
      target: { entity_id: "all" },
      data: {}
    }
  };
}
function stateCountExpression(domains, bucket) {
  const conditions = domains.flatMap(
    (domain) => (DOMAIN_STATE_BUCKETS[domain]?.[bucket] ?? []).map(
      (state) => `(s.entity_id.startsWith('${domain}.') && s.state === '${state}')`
    )
  ).join(" || ");
  return `Object.values(hass.states).filter(s => ${conditions || "false"}).length`;
}
function buildStateIncludes(domains, bucket, options) {
  return domains.flatMap(
    (domain) => (DOMAIN_STATE_BUCKETS[domain]?.[bucket] ?? []).map((state) => ({
      domain,
      state,
      options: entityCardTemplate(domain, options)
    }))
  );
}
function buildStaticGroupedCards(summary, grouping, hass, options) {
  const sections = groupEntries(summary, grouping, hass);
  const cards = [];
  sections.forEach((section) => {
    if (section.title) {
      cards.push(bubbleSeparator(section.title, section.icon));
    }
    cards.push({
      type: "grid",
      square: false,
      columns: summary.columns,
      cards: section.entities.map((entity) => entityToCard(entity, options))
    });
  });
  return cards;
}
function groupEntries(summary, grouping, hass) {
  if (grouping === "none") {
    const entities = [...summary.entries].map((entry) => entry.entity).sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
    return [{ title: null, icon: "", entities }];
  }
  const sections = [];
  const indexByArea = /* @__PURE__ */ new Map();
  summary.entries.forEach((entry) => {
    let index = indexByArea.get(entry.area.area_id);
    if (index === void 0) {
      index = sections.length;
      indexByArea.set(entry.area.area_id, index);
      sections.push({ title: entry.area.name, icon: entry.area.icon || "mdi:home-outline", entities: [] });
    }
    sections[index].entities.push(entry.entity);
  });
  return sections;
}
var SECURITY_HAZARD_CLASSES = ["smoke", "gas", "carbon_monoxide", "moisture"];
var SECURITY_OPENING_CLASSES = ["door", "garage_door", "window", "opening"];
var SECURITY_MOTION_CLASSES = ["motion", "occupancy", "moving", "presence", "vibration", "sound"];
var SECURITY_BUTTON_TEMPLATE = { type: "custom:bubble-card", card_type: "button", button_type: "state" };
function buildSecurityCards(hass, options, t) {
  const cards = [];
  const showAlarmControls = options.show_alarm_controls ?? DEFAULT_SHOW_ALARM_CONTROLS;
  const alarms = entityIdsForDomain(hass, "alarm_control_panel");
  if (alarms.length) {
    cards.push(bubbleSeparator(t("alarm"), "mdi:shield-home"));
    cards.push({
      type: "grid",
      square: false,
      columns: 1,
      cards: alarms.map((entityId) => buildAlarmCard(entityId, showAlarmControls, t))
    });
  }
  const locks = entityIdsForDomain(hass, "lock");
  if (locks.length) {
    cards.push(bubbleSeparator(t("locks"), "mdi:lock"));
    cards.push({
      type: "grid",
      square: false,
      columns: 2,
      cards: locks.map((entityId) => buildLockCard(entityId, t))
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
function buildAlarmCard(entityId, showControls, t) {
  const card = {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "state",
    entity: entityId,
    card_layout: DESIGN.cardLayout.alarm
  };
  if (showControls) {
    card.sub_button = [
      alarmControl(t("armAway"), "mdi:shield-lock", "alarm_control_panel.alarm_arm_away", entityId),
      alarmControl(t("armHome"), "mdi:shield-home", "alarm_control_panel.alarm_arm_home", entityId),
      alarmControl(t("disarm"), "mdi:shield-off", "alarm_control_panel.alarm_disarm", entityId)
    ];
  }
  return card;
}
function alarmControl(name, icon, service, entityId) {
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
      data: {}
    }
  };
}
function buildLockCard(entityId, t) {
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "state",
    entity: entityId,
    card_layout: DESIGN.cardLayout.lock,
    sub_button: [
      lockControl(t("unlock"), "mdi:lock-open-variant", "lock.unlock", entityId),
      lockControl(t("lock"), "mdi:lock", "lock.lock", entityId)
    ]
  };
}
function lockControl(name, icon, service, entityId) {
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
      data: {}
    }
  };
}
function entityIdsForDomain(hass, domain) {
  return Object.keys(hass.states).filter((entityId) => getDomain(entityId) === domain).sort();
}
function securityClassIncludes(deviceClasses, state) {
  return deviceClasses.map((deviceClass) => ({
    domain: "binary_sensor",
    attributes: { device_class: deviceClass },
    ...state ? { state } : {},
    options: SECURITY_BUTTON_TEMPLATE
  }));
}
function hasBinarySensorClass(hass, deviceClasses) {
  return Object.values(hass.states).some(
    (state) => getDomain(state.entity_id) === "binary_sensor" && deviceClasses.includes(String(state.attributes.device_class ?? ""))
  );
}
function buildBatteryCards(options, t) {
  const template = { type: "custom:bubble-card", card_type: "button", button_type: "state" };
  const critical = options.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
  const low = Math.max(options.battery_low_below ?? DEFAULT_BATTERY_LOW_BELOW, critical);
  const hideMobile = options.hide_mobile_app_batteries ?? DEFAULT_HIDE_MOBILE_APP_BATTERIES;
  const mobileExclude = hideMobile ? [{ integration: "mobile_app" }] : [];
  const sort = { method: "state", numeric: true };
  const batteryInclude = (state) => [
    { domain: "sensor", attributes: { device_class: "battery" }, state, options: template }
  ];
  return [
    bubbleSeparator(t("critical"), "mdi:battery-alert"),
    autoEntitiesGrid({ columns: 2, include: batteryInclude(`< ${critical}`), exclude: mobileExclude, sort }),
    bubbleSeparator(t("low"), "mdi:battery-low"),
    autoEntitiesGrid({
      columns: 2,
      include: batteryInclude(`< ${low}`),
      exclude: [...mobileExclude, { domain: "sensor", attributes: { device_class: "battery" }, state: `< ${critical}` }],
      sort
    }),
    bubbleSeparator(t("ok"), "mdi:battery"),
    autoEntitiesGrid({ columns: 2, include: batteryInclude(`>= ${low}`), exclude: mobileExclude, sort })
  ];
}

// src/views/home-view.ts
function buildHomeView(areas, entities, devices, hass, options) {
  const t = createTranslator(hass);
  const activeSummaries = getActiveSummaries(areas, entities, devices, hass, options);
  return { type: "sections", max_columns: 2, sections: [{ type: "grid", cards: [
    buildTopNavigation(hass, options),
    ...buildAdaptiveHomeSurface(hass, options),
    ...activeSummaries.length ? [buildSummaryNavigation(activeSummaries, t)] : [],
    bubbleSeparator(t("rooms"), "mdi:floor-plan"),
    { type: "grid", square: false, columns: 2, cards: buildSmartRoomCards(areas, entities, devices, hass, options) },
    ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options, t)),
    ...buildSummaryPopups(activeSummaries, hass, options, t),
    buildFooter(areas, t("rooms"))
  ] }] };
}
function buildAdaptiveHomeSurface(hass, options) {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const mediaCandidate = findLastUsedMediaPlayer(hass);
  const media = mediaCandidate && ["playing", "paused"].includes(hass.states[mediaCandidate]?.state) ? mediaCandidate : void 0;
  const vacuum = findStateEntities(hass, ["vacuum"]).find((id) => {
    const s = hass.states[id]?.state;
    return s && !["docked", "idle", "off", "unavailable", "unknown"].includes(s);
  });
  const mode = options.home_hero_mode ?? "adaptive";
  const contextual = options.contextual_home_cards ?? true;
  const cards = [];
  if (mode === "media" && media) cards.push(mediaPlayerToCard(media, options));
  else if (mode === "weather" && weather) cards.push(weatherCard(weather));
  else if (mode === "adaptive") {
    if (media) cards.push(mediaPlayerToCard(media, options));
    else if (vacuum) cards.push(vacuumCard(vacuum));
    else if (weather) cards.push(weatherCard(weather));
  }
  if (!contextual) {
    if (weather && !(mode === "weather" || !media && !vacuum && mode === "adaptive")) cards.push(weatherCard(weather));
    if (media && !(mode === "media" || mode === "adaptive")) cards.push(mediaPlayerToCard(media, options));
  } else if (vacuum && !(mode === "adaptive" && !media)) cards.push(vacuumCard(vacuum));
  return cards;
}
function weatherCard(entity) {
  return { type: "weather-forecast", entity, forecast_type: "daily" };
}
function vacuumCard(entity) {
  return { type: "custom:bubble-card", card_type: "button", button_type: "state", entity, show_state: true, card_layout: "large", rows: 2, button_action: { tap_action: { action: "more-info" } }, sub_button: { main: [], bottom: [{ buttons_layout: "inline", justify_content: "fill", group: [
    { entity, icon: "mdi:play", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.start", target: { entity_id: entity } } },
    { entity, icon: "mdi:pause", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.pause", target: { entity_id: entity } } },
    { entity, icon: "mdi:home-map-marker", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.return_to_base", target: { entity_id: entity } } }
  ] }] } };
}
function buildRoomPopup(area, entities, devices, hass, options, t) {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options);
  const max = options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
  let remaining = max;
  const groups = groupRoomEntities(areaEntities).map((group) => {
    const visible = group.entities.slice(0, remaining);
    remaining -= visible.length;
    return { ...group, entities: visible };
  });
  const cards = [];
  groups.forEach((group) => {
    if (!group.entities.length) return;
    cards.push(bubbleSeparator(t(group.titleKey), group.icon));
    cards.push(...buildResponsiveEntityGrids(group.entities, options, hass));
  });
  if (!cards.length) cards.push({ type: "markdown", content: t("noEntities") });
  return bubblePopup({ hash: getRoomHash(area), name: area.name, icon: area.icon || "mdi:home-outline", cards });
}
function buildResponsiveEntityGrids(entities, options, hass) {
  const runs = [];
  entities.forEach((entity) => {
    const presentation = getEntityPresentation(entity, options, hass);
    const card = entityToCard(entity, options, hass);
    const current = runs[runs.length - 1];
    if (current?.presentation === presentation) current.cards.push(card);
    else runs.push({ presentation, cards: [card] });
  });
  return runs.map((run) => ({ type: "grid", square: false, columns: run.presentation === "wide" ? 1 : 2, cards: run.cards }));
}

// src/strategies.ts
var BubbleDashboardStrategy = class extends HTMLElement {
  static getCreateSuggestions(_hass) {
    return {
      title: "Bubble Card Dashboard",
      icon: "mdi:home-variant"
    };
  }
  static async generate(config, hass) {
    const { areas, devices, entities } = await getRegistries(hass);
    const activeAreas = orderAreas(getActiveAreas(areas, entities, devices), config);
    return {
      title: config.title || hass.config.location_name || "Bubble Card Dashboard",
      views: [
        {
          title: "Dashboard",
          path: "dashboard",
          icon: "mdi:view-dashboard",
          strategy: {
            type: `custom:${STRATEGY_TYPE}`,
            view: "home",
            areas: activeAreas,
            devices,
            entities,
            options: config
          }
        }
      ]
    };
  }
  static async getConfigElement() {
    await customElements.whenDefined(EDITOR_ELEMENT);
    return document.createElement(EDITOR_ELEMENT);
  }
};
var BubbleViewStrategy = class extends HTMLElement {
  static async generate(config, hass) {
    const options = config.options || {};
    if (config.view === "home") {
      return buildHomeView(
        config.areas,
        config.entities,
        config.devices,
        hass,
        options
      );
    }
    return buildAreaView(
      config.area,
      config.entities,
      config.devices,
      hass,
      options
    );
  }
};

// src/index.ts
if (!customElements.get(DASHBOARD_ELEMENT)) {
  customElements.define(DASHBOARD_ELEMENT, BubbleDashboardStrategy);
}
if (!customElements.get(VIEW_ELEMENT)) {
  customElements.define(VIEW_ELEMENT, BubbleViewStrategy);
}
if (!customElements.get(EDITOR_ELEMENT)) {
  customElements.define(EDITOR_ELEMENT, BubbleCardDashboardStrategyEditor);
}
window.customStrategies = window.customStrategies || [];
if (!window.customStrategies.some((strategy) => strategy.type === STRATEGY_TYPE && strategy.strategyType === "dashboard")) {
  window.customStrategies.push({
    type: STRATEGY_TYPE,
    strategyType: "dashboard",
    name: "Bubble Card Dashboard",
    description: "Generates an area-based dashboard with Bubble Card controls.",
    documentationURL: "https://github.com/nikosta87/bubble-card-dashboard-strategy"
  });
}
console.info(
  `%cBUBBLE-CARD-DASHBOARD-STRATEGY%c ${VERSION}`,
  "color: white; background: #1d8cf8; font-weight: 700; padding: 2px 4px; border-radius: 3px;",
  "color: #1d8cf8; font-weight: 700;"
);
