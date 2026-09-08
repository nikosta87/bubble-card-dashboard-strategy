// src/constants.ts
var STRATEGY_TYPE = "bubble-card-dashboard";
var DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
var VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
var EDITOR_ELEMENT = "bubble-card-dashboard-strategy-editor";
var VERSION = "0.23.0";
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
  "hide_mobile_app_batteries"
]);
var BubbleCardDashboardStrategyEditor = class extends HTMLElement {
  _config = {};
  _hass;
  _areas = [];
  _areasLoaded = false;
  _areasLoading = false;
  _rendered = false;
  set hass(hass) {
    this._hass = hass;
    this.loadAreas();
    if (!this._rendered) {
      this.render();
    }
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
    if (!this._hass || this._areasLoaded || this._areasLoading) {
      return;
    }
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
  render() {
    this._rendered = true;
    const maxEntities = this._config.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
    const enableAdvancedControls = this._config.enable_advanced_controls ?? DEFAULT_ENABLE_ADVANCED_CONTROLS;
    const themeGrouping = this._config.theme_grouping ?? "auto";
    const roomOrder = this._config.room_order ?? DEFAULT_ROOM_ORDER;
    const showLightSummary = this._config.show_light_summary ?? true;
    const showSecuritySummary = this._config.show_security_summary ?? true;
    const showClimateSummary = this._config.show_climate_summary ?? true;
    const showBatterySummary = this._config.show_battery_summary ?? true;
    const hideMobileBatteries = this._config.hide_mobile_app_batteries ?? DEFAULT_HIDE_MOBILE_APP_BATTERIES;
    const batteryCritical = this._config.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;
    const batteryLow = this._config.battery_low_below ?? DEFAULT_BATTERY_LOW_BELOW;
    const showAlarmControls = this._config.show_alarm_controls ?? DEFAULT_SHOW_ALARM_CONTROLS;
    this.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
        }

        .section {
          margin: 0 0 28px;
        }

        .section-title {
          font-weight: 600;
          margin: 0 0 14px;
        }

        .field {
          display: grid;
          grid-template-columns: minmax(150px, 220px) 1fr;
          gap: 16px;
          align-items: center;
          margin: 16px 0 8px;
        }

        label {
          font-weight: 500;
        }

        input,
        select {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font: inherit;
          padding: 10px 12px;
        }

        input[type="checkbox"],
        input[type="radio"] {
          width: auto;
        }

        .radio-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .radio-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 400;
        }

        .hint {
          grid-column: 2;
          color: var(--secondary-text-color);
          font-size: 0.9em;
          line-height: 1.4;
          margin-top: 2px;
        }

        .room-list {
          margin-top: 12px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          overflow: hidden;
        }

        .room-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--divider-color);
        }

        .room-row:last-child {
          border-bottom: none;
        }

        .room-row input[type="checkbox"] {
          width: auto;
          margin: 0;
        }

        .room-name {
          flex: 1;
        }

        .room-actions {
          display: flex;
          gap: 6px;
        }

        .room-actions button {
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font: inherit;
          cursor: pointer;
        }

        .room-actions button[disabled] {
          opacity: 0.4;
          cursor: default;
        }

        .room-empty {
          padding: 12px;
          color: var(--secondary-text-color);
        }

        @media (max-width: 640px) {
          .field {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .hint {
            grid-column: 1;
          }
        }
      </style>

      <div class="section">
        <div class="section-title">General</div>
        <div class="field">
          <label for="title">Dashboard title</label>
          <input id="title" data-field="title" type="text" value="${escapeHtml(this._config.title || "")}" placeholder="${escapeHtml(this._hass?.config.location_name || "Bubble Card Dashboard")}">
          <div class="hint">Leave empty to use the Home Assistant location name.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Navigation</div>
        <div class="field">
          <label for="profile_image">Profile image</label>
          <input id="profile_image" data-field="profile_image" type="text" value="${escapeHtml(this._config.profile_image || "")}" placeholder="/local/profile.jpg">
          <div class="hint">Optional image URL for the round avatar. Leave empty to show the current user's initial.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Controls</div>
        <div class="field">
          <label for="enable_advanced_controls">Advanced Bubble controls</label>
          <input id="enable_advanced_controls" data-field="enable_advanced_controls" type="checkbox" ${enableAdvancedControls ? "checked" : ""}>
          <div class="hint">Uses Bubble sliders and select sub-buttons for compatible lights, fans, numbers, climate entities and media players.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Rooms</div>
        <div class="field">
          <label for="max_entities_per_area">Max entities per room</label>
          <input id="max_entities_per_area" data-field="max_entities_per_area" type="number" min="1" max="100" value="${maxEntities}">
          <div class="hint">Limits how many generated entity cards are shown inside each room pop-up.</div>
        </div>
        <div class="field">
          <label for="room_order">Room order</label>
          <select id="room_order" data-field="room_order">
            ${roomOrderOption("home_assistant", "Home Assistant order", roomOrder)}
            ${roomOrderOption("alphabetical", "Alphabetical", roomOrder)}
            ${roomOrderOption("custom", "Custom", roomOrder)}
          </select>
          <div class="hint">Choose how rooms are ordered. Select "Custom" to arrange them with the arrows below.</div>
        </div>
        ${this.renderRoomList(roomOrder)}
      </div>

      <div class="section">
        <div class="section-title">Summaries</div>
        <div class="field">
          <label for="show_light_summary">Light summary</label>
          <input id="show_light_summary" data-field="show_light_summary" type="checkbox" ${showLightSummary ? "checked" : ""}>
        </div>
        <div class="field">
          <label for="show_security_summary">Security summary</label>
          <input id="show_security_summary" data-field="show_security_summary" type="checkbox" ${showSecuritySummary ? "checked" : ""}>
          <div class="hint">Shows locks, smoke &amp; leak sensors, doors &amp; windows (open/closed) and motion, plus any alarm panel, in logical groups.</div>
        </div>
        <div class="field">
          <label for="show_alarm_controls">Alarm controls</label>
          <input id="show_alarm_controls" data-field="show_alarm_controls" type="checkbox" ${showAlarmControls ? "checked" : ""}>
          <div class="hint">Shows arm/disarm buttons on the alarm tile in the security summary. Turn off for a display-only alarm.</div>
        </div>
        <div class="field">
          <label for="show_climate_summary">Climate summary</label>
          <input id="show_climate_summary" data-field="show_climate_summary" type="checkbox" ${showClimateSummary ? "checked" : ""}>
        </div>
        <div class="field">
          <label for="show_battery_summary">Battery summary</label>
          <input id="show_battery_summary" data-field="show_battery_summary" type="checkbox" ${showBatterySummary ? "checked" : ""}>
        </div>
        <div class="field">
          <label for="hide_mobile_app_batteries">Hide mobile app batteries</label>
          <input id="hide_mobile_app_batteries" data-field="hide_mobile_app_batteries" type="checkbox" ${hideMobileBatteries ? "checked" : ""}>
          <div class="hint">Hides phone, tablet and watch batteries (Mobile App) from the battery summary.</div>
        </div>
        <div class="field">
          <label for="battery_critical_below">Battery critical below</label>
          <input id="battery_critical_below" data-field="battery_critical_below" type="number" min="1" max="100" value="${batteryCritical}">
          <div class="hint">Batteries below this percentage appear in the Critical group.</div>
        </div>
        <div class="field">
          <label for="battery_low_below">Battery low below</label>
          <input id="battery_low_below" data-field="battery_low_below" type="number" min="1" max="100" value="${batteryLow}">
          <div class="hint">Batteries below this percentage (but at or above critical) appear in the Low group; the rest are OK.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Summary grouping</div>
        <div class="field">
          <label for="theme_grouping">Group entities by</label>
          <select id="theme_grouping" data-field="theme_grouping">
            ${themeGroupingOption("auto", "Automatic (per summary)", themeGrouping)}
            ${themeGroupingOption("area", "Room", themeGrouping)}
            ${themeGroupingOption("state", "On / off status", themeGrouping)}
            ${themeGroupingOption("none", "No grouping", themeGrouping)}
          </select>
          <div class="hint">How the Lights and Climate summaries group their entities. "Automatic" uses the best fit per summary (lights by status, climate by room).</div>
        </div>
      </div>
    `;
    this.querySelectorAll("[data-field]").forEach((element) => {
      element.addEventListener("change", (event) => this.handleChange(event));
      element.addEventListener("input", (event) => this.handleInput(event));
    });
    this.querySelectorAll("[data-room-visible]").forEach((element) => {
      element.addEventListener("change", (event) => this.handleRoomVisibility(event));
    });
    this.querySelectorAll("[data-room-move]").forEach((element) => {
      element.addEventListener("click", (event) => this.handleRoomMove(event));
    });
  }
  renderRoomList(roomOrder) {
    if (!this._areasLoaded) {
      return `<div class="room-list"><div class="room-empty">Loading rooms\u2026</div></div>`;
    }
    if (!this._areas.length) {
      return `<div class="room-list"><div class="room-empty">No rooms with entities found.</div></div>`;
    }
    const hiddenAreas = new Set(this._config.hidden_areas ?? []);
    const orderedAreas = this.orderedAreasForDisplay();
    const showMoveButtons = roomOrder === "custom";
    const rows = orderedAreas.map((area, index) => {
      const areaId = escapeHtml(area.area_id);
      const actions = showMoveButtons ? `<span class="room-actions">
              <button type="button" data-room-move="up" data-area="${areaId}" ${index === 0 ? "disabled" : ""} aria-label="Move up">\u2191</button>
              <button type="button" data-room-move="down" data-area="${areaId}" ${index === orderedAreas.length - 1 ? "disabled" : ""} aria-label="Move down">\u2193</button>
            </span>` : "";
      return `
          <div class="room-row">
            <input type="checkbox" data-room-visible="${areaId}" ${hiddenAreas.has(area.area_id) ? "" : "checked"}>
            <span class="room-name">${escapeHtml(area.name)}</span>
            ${actions}
          </div>`;
    }).join("");
    return `<div class="room-list">${rows}</div>`;
  }
  handleInput(event) {
    const target = event.target;
    if (target.dataset.field === "title" || target.dataset.field === "profile_image") {
      this.updateConfig(target.dataset.field, target.value || void 0);
    }
  }
  handleChange(event) {
    const target = event.target;
    const field = target.dataset.field;
    if (!field || field === "title") {
      return;
    }
    if (field === "max_entities_per_area") {
      this.updateConfig(field, clampNumber(Number(target.value), 1, 100));
      return;
    }
    if (field === "battery_critical_below" || field === "battery_low_below") {
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
    const areaId = target.dataset.roomVisible;
    if (!areaId) {
      return;
    }
    const hidden = new Set(this._config.hidden_areas ?? []);
    if (target.checked) {
      hidden.delete(areaId);
    } else {
      hidden.add(areaId);
    }
    const hiddenList = [...hidden];
    this.updateConfig("hidden_areas", hiddenList.length ? hiddenList : void 0);
  }
  handleRoomMove(event) {
    const target = event.currentTarget;
    const areaId = target.dataset.area;
    const direction = target.dataset.roomMove;
    if (!areaId || direction !== "up" && direction !== "down") {
      return;
    }
    const order = this.orderedAreasForDisplay().map((area) => area.area_id);
    const index = order.indexOf(areaId);
    const target_index = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target_index < 0 || target_index >= order.length) {
      return;
    }
    [order[index], order[target_index]] = [order[target_index], order[index]];
    this.updateConfig("custom_room_order", order);
    this.render();
  }
  updateConfig(field, value) {
    const nextConfig = {
      ...this._config,
      [field]: value
    };
    if (value === void 0 || value === "") {
      delete nextConfig[field];
    }
    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: {
          config: nextConfig
        },
        bubbles: true,
        composed: true
      })
    );
  }
};
function themeGroupingOption(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}
function roomOrderOption(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

// src/design.ts
var DESIGN = {
  popup: {
    widthDesktop: "540px",
    bgOpacity: "92",
    bgBlur: "14"
  },
  // card_layout for cards whose sub-buttons should sit on a second row instead of
  // inline with the name.
  cardLayout: {
    alarm: "large-2-rows",
    lock: "large-2-rows"
  }
};
var THEME_TOKENS = {
  "--bcds-accent": "var(--primary-color)",
  "--bcds-radius": "var(--ha-card-border-radius, 18px)"
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

      if (!stateObj || stateObj.state !== 'on') {
        clear();
        return '';
      }

      let rgb = Array.isArray(attrs.rgb_color) ? attrs.rgb_color.slice(0, 3).map(Number) : null;
      let kelvin = Number(attrs.color_temp_kelvin || 0);
      if (!kelvin && Number(attrs.color_temp || 0) > 0) kelvin = 1000000 / Number(attrs.color_temp);

      if (!rgb && kelvin > 0) {
        const temp = Math.max(10, Math.min(400, kelvin / 100));
        const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
        let red;
        let green;
        let blue;

        if (temp <= 66) {
          red = 255;
          green = 99.4708025861 * Math.log(temp) - 161.1195681661;
          blue = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
        } else {
          red = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
          green = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
          blue = 255;
        }
        rgb = [clamp(red), clamp(green), clamp(blue)];
      }

      if (!rgb || rgb.some((value) => !Number.isFinite(value))) {
        clear();
        return '';
      }

      const brightness = Math.max(0, Math.min(255, Number(attrs.brightness ?? 180))) / 255;
      const surfaceAlpha = (0.10 + brightness * 0.12).toFixed(3);
      const iconAlpha = (0.20 + brightness * 0.16).toFixed(3);
      const color = rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))));
      card.style.setProperty('--bubble-button-main-background-color', 'rgba(' + color.join(',') + ',' + surfaceAlpha + ')');
      card.style.setProperty('--bubble-button-icon-background-color', 'rgba(' + color.join(',') + ',' + iconAlpha + ')');
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
      next_button: true
    },
    ...advanced ? {
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
                hide_when_parent_unavailable: true
              }
            ]
          }
        ]
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
  const primaryEntity = findRoomPrimaryEntity(areaEntities);
  const statusEntities = findRoomStatusEntities(areaEntities, hass).filter(
    (entity) => entity.entity_id !== primaryEntity?.entity_id
  );
  const primaryDomain = primaryEntity ? getDomain(primaryEntity.entity_id) : "";
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: primaryEntity ? ["light", "switch"].includes(primaryDomain) ? "switch" : "state" : "name",
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    ...primaryEntity ? { entity: primaryEntity.entity_id } : {},
    ...primaryDomain === "light" ? { use_accent_color: false, styles: bubbleLightSurfaceStyles() } : {},
    card_layout: "large",
    rows: 2,
    show_name: true,
    show_state: false,
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: getRoomHash(area)
      }
    },
    ...statusEntities.length ? {
      sub_button: {
        main: [],
        bottom: [
          {
            buttons_layout: "inline",
            justify_content: "start",
            group: statusEntities.map(roomStatusSubButton)
          }
        ]
      }
    } : {}
  };
}
function findRoomPrimaryEntity(entities) {
  for (const domain of ["light", "switch", "climate", "cover"]) {
    const entity = entities.find((candidate) => getDomain(candidate.entity_id) === domain);
    if (entity) return entity;
  }
  return void 0;
}
function findRoomStatusEntities(entities, hass) {
  const findByDeviceClass = (domain, deviceClasses) => entities.find((entity) => {
    const state = hass.states[entity.entity_id];
    return getDomain(entity.entity_id) === domain && deviceClasses.includes(String(state?.attributes.device_class || ""));
  });
  const candidates = [
    findByDeviceClass("sensor", ["temperature"]),
    findByDeviceClass("binary_sensor", ["door", "window", "opening"]),
    findByDeviceClass("binary_sensor", ["occupancy", "presence", "motion"]),
    entities.find((entity) => getDomain(entity.entity_id) === "light")
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
    tap_action: {
      action: domain === "light" ? "toggle" : "more-info"
    }
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
  const overviewCards = buildOverviewCards(hass, options);
  return {
    type: "sections",
    max_columns: 2,
    sections: [
      {
        type: "grid",
        cards: [
          buildTopNavigation(hass, options),
          ...overviewCards,
          ...activeSummaries.length ? [buildSummaryNavigation(activeSummaries, t)] : [],
          ...buildRoomsSection(areas, entities, devices, hass, options, t),
          ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options, t)),
          ...buildSummaryPopups(activeSummaries, hass, options, t),
          buildFooter(areas, t("rooms"))
        ]
      }
    ]
  };
}
function buildOverviewCards(hass, options) {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const candidateMediaPlayer = findLastUsedMediaPlayer(hass);
  const mediaPlayer = candidateMediaPlayer && ["playing", "paused"].includes(hass.states[candidateMediaPlayer]?.state) ? candidateMediaPlayer : void 0;
  const activeVacuum = findStateEntities(hass, ["vacuum"]).find((entity) => {
    const state = hass.states[entity]?.state;
    return state && !["docked", "idle", "off", "unavailable", "unknown"].includes(state);
  });
  return [
    ...weather ? [{ type: "weather-forecast", entity: weather, forecast_type: "daily" }] : [],
    ...mediaPlayer ? [mediaPlayerToCard(mediaPlayer, options)] : [],
    ...activeVacuum ? [{
      type: "custom:bubble-card",
      card_type: "button",
      button_type: "state",
      entity: activeVacuum,
      show_state: true,
      card_layout: "large",
      rows: 2,
      button_action: { tap_action: { action: "more-info" } },
      sub_button: {
        main: [],
        bottom: [
          {
            buttons_layout: "inline",
            justify_content: "fill",
            group: [
              { entity: activeVacuum, icon: "mdi:play", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.start", target: { entity_id: activeVacuum } } },
              { entity: activeVacuum, icon: "mdi:pause", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.pause", target: { entity_id: activeVacuum } } },
              { entity: activeVacuum, icon: "mdi:home-map-marker", show_background: false, fill_width: true, tap_action: { action: "perform-action", perform_action: "vacuum.return_to_base", target: { entity_id: activeVacuum } } }
            ]
          }
        ]
      }
    }] : []
  ];
}
function buildRoomsSection(areas, entities, devices, hass, options, t) {
  return [
    bubbleSeparator(t("rooms"), "mdi:floor-plan"),
    {
      type: "grid",
      square: false,
      columns: 2,
      cards: buildSmartRoomCards(areas, entities, devices, hass, options)
    }
  ];
}
function buildRoomPopup(area, entities, devices, hass, options, t) {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options);
  const maxEntities = options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
  let remainingEntities = maxEntities;
  const groups = groupRoomEntities(areaEntities).map((group) => {
    const visibleEntities = group.entities.slice(0, remainingEntities);
    remainingEntities -= visibleEntities.length;
    return { ...group, entities: visibleEntities };
  });
  const cards = [];
  groups.forEach((group) => {
    if (!group.entities.length) return;
    cards.push(bubbleSeparator(t(group.titleKey), group.icon));
    cards.push(...buildResponsiveEntityGrids(group.entities, options, hass));
  });
  if (!cards.length) {
    cards.push({ type: "markdown", content: t("noEntities") });
  }
  return bubblePopup({
    hash: getRoomHash(area),
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    cards
  });
}
function buildResponsiveEntityGrids(entities, options, hass) {
  const runs = [];
  entities.forEach((entity) => {
    const presentation = getEntityPresentation(entity, options, hass);
    const card = entityToCard(entity, options, hass);
    const current = runs[runs.length - 1];
    if (current?.presentation === presentation) {
      current.cards.push(card);
    } else {
      runs.push({ presentation, cards: [card] });
    }
  });
  return runs.map((run) => ({
    type: "grid",
    square: false,
    columns: run.presentation === "wide" ? 1 : 2,
    cards: run.cards
  }));
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
