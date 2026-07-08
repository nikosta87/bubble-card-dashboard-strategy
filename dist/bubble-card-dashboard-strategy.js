// src/constants.ts
var STRATEGY_TYPE = "bubble-card-dashboard";
var DASHBOARD_ELEMENT = "ll-strategy-dashboard-bubble-card-dashboard";
var VIEW_ELEMENT = "ll-strategy-view-bubble-card-dashboard";
var EDITOR_ELEMENT = "bubble-card-dashboard-strategy-editor";
var VERSION = "0.16.0";
var DEFAULT_MAX_ENTITIES_PER_AREA = 24;
var DEFAULT_MEDIA_PLAYER_CARD = "bubble-card";
var DEFAULT_SHOW_CAMERA_BUTTON = true;
var DEFAULT_ENABLE_SONOS_GROUPING = true;
var DEFAULT_THEME_GROUPING = "state";
var DEFAULT_ROOM_ORDER = "alphabetical";
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
  scene: "button",
  script: "button",
  select: "select",
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

// src/cards/media-player.ts
function mediaPlayerToCard(entityId, options, sonosEntities = []) {
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
          when_standby: true
        },
        ...shouldAddSonosGrouping(options, sonosEntities) ? {
          speaker_group: {
            platform: "sonos",
            entities: sonosEntities,
            sync_volume: true,
            show_group_count: true
          }
        } : {}
      };
    case "yamp":
      return {
        type: "custom:yet-another-media-player",
        entities: [entityId],
        idle_screen: "search-recently-played",
        artwork_object_fit: "cover"
      };
    case "bubble-card":
    default:
      return {
        type: "custom:bubble-card",
        card_type: "media-player",
        entity: entityId
      };
  }
}
function getMediaPlayerCardType(options) {
  const configValue = normalizeMediaPlayerCardType(options.media_player_card);
  if (configValue) {
    return configValue;
  }
  return DEFAULT_MEDIA_PLAYER_CARD;
}
function normalizeMediaPlayerCardType(value) {
  const normalizedValue = value?.toLowerCase().trim().replace(/\s+/g, "-").replace(/^yet-another-media-player$/, "yamp");
  if (normalizedValue === "bubble-card" || normalizedValue === "mini-media-player" || normalizedValue === "yamp") {
    return normalizedValue;
  }
  return void 0;
}
function shouldAddSonosGrouping(options, sonosEntities) {
  return (options.enable_sonos_grouping ?? DEFAULT_ENABLE_SONOS_GROUPING) && sonosEntities.length > 1;
}

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
function findPrimaryEntityForArea(areaId, entities, devices) {
  return entities.find((entity) => {
    const domain = getDomain(entity.entity_id);
    return ["light", "switch", "climate", "cover"].includes(domain) && entityBelongsToArea(entity, areaId, devices);
  });
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
function getSonosMediaPlayers(entities, options) {
  return [
    .../* @__PURE__ */ new Set([
      ...entities.filter(isSonosMediaPlayer).map((entity) => entity.entity_id),
      ...(options.sonos_entities || []).filter((entityId) => getDomain(entityId) === "media_player")
    ])
  ].sort();
}
function isSonosMediaPlayer(entity) {
  return getDomain(entity.entity_id) === "media_player" && entity.platform === "sonos";
}
function getUserInitial(hass) {
  return (hass.user?.name || "?").trim().slice(0, 1).toUpperCase() || "?";
}
function getRoomHash(area) {
  return `#room-${slugify(area.name || area.area_id)}`;
}

// src/editor.ts
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
      media_player_card: DEFAULT_MEDIA_PLAYER_CARD,
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      show_camera_button: DEFAULT_SHOW_CAMERA_BUTTON,
      enable_sonos_grouping: DEFAULT_ENABLE_SONOS_GROUPING,
      theme_grouping: DEFAULT_THEME_GROUPING,
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
    const mediaPlayerCard = getMediaPlayerCardType(this._config);
    const maxEntities = this._config.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
    const showCameraButton = this._config.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON;
    const enableSonosGrouping = this._config.enable_sonos_grouping ?? DEFAULT_ENABLE_SONOS_GROUPING;
    const themeGrouping = this._config.theme_grouping ?? DEFAULT_THEME_GROUPING;
    const roomOrder = this._config.room_order ?? DEFAULT_ROOM_ORDER;
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
          <label for="show_camera_button">Camera button</label>
          <input id="show_camera_button" data-field="show_camera_button" type="checkbox" ${showCameraButton ? "checked" : ""}>
          <div class="hint">Shows or hides the camera icon in the top navigation.</div>
        </div>
        <div class="field">
          <label for="profile_image">Profile image</label>
          <input id="profile_image" data-field="profile_image" type="text" value="${escapeHtml(this._config.profile_image || "")}" placeholder="/local/profile.jpg">
          <div class="hint">Optional image URL for the round avatar. Leave empty to show the current user's initial.</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Media</div>
        <div class="field">
          <label for="media_player_card">Media player card</label>
          <select id="media_player_card" data-field="media_player_card">
            ${mediaPlayerCardOption("bubble-card", "Bubble Card", mediaPlayerCard)}
            ${mediaPlayerCardOption("mini-media-player", "Mini Media Player", mediaPlayerCard)}
            ${mediaPlayerCardOption("yamp", "Yet Another Media Player", mediaPlayerCard)}
          </select>
          <div class="hint">Mini Media Player and YAMP must be installed separately before selecting them.</div>
        </div>
        <div class="field">
          <label for="enable_sonos_grouping">Sonos grouping</label>
          <input id="enable_sonos_grouping" data-field="enable_sonos_grouping" type="checkbox" ${enableSonosGrouping ? "checked" : ""}>
          <div class="hint">Adds Mini Media Player speaker group controls for detected Sonos media players.</div>
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
        <div class="section-title">Theme views</div>
        <div class="field">
          <label for="theme_grouping">Group entities by</label>
          <select id="theme_grouping" data-field="theme_grouping">
            ${themeGroupingOption("area", "Room", themeGrouping)}
            ${themeGroupingOption("state", "On / off status", themeGrouping)}
            ${themeGroupingOption("none", "No grouping", themeGrouping)}
          </select>
          <div class="hint">Controls how the Lights, Covers, Climate and Media theme views are grouped.</div>
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
    if (field === "show_camera_button" || field === "enable_sonos_grouping") {
      this.updateConfig(field, target.checked);
      return;
    }
    if (field === "room_order") {
      this.updateConfig(field, target.value);
      this.render();
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
function mediaPlayerCardOption(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}
function themeGroupingOption(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}
function roomOrderOption(value, label, selectedValue) {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

// src/cards/common.ts
function fixedHomeCard(card) {
  return {
    ...card,
    card_mod: {
      style: `
        ha-card {
          height: 190px;
          min-height: 190px;
          max-height: 190px;
          overflow: hidden;
        }
      `
    }
  };
}
function bubbleSeparator(name, icon) {
  return {
    type: "custom:bubble-card",
    card_type: "separator",
    name,
    icon
  };
}
function buttonToHash(name, icon, hash, entity) {
  return {
    type: "custom:bubble-card",
    card_type: "button",
    button_type: "name",
    name,
    icon,
    entity,
    button_action: {
      tap_action: {
        action: "navigate",
        navigation_path: hash
      }
    }
  };
}
function buildFooter(areas) {
  const footer = {
    type: "custom:bubble-card",
    card_type: "horizontal-buttons-stack",
    "1_link": ROOMS_POPUP_HASH,
    "1_name": "Rooms",
    "1_icon": "mdi:floor-plan",
    auto_order: false,
    highlight_current_view: true
  };
  areas.slice(0, 6).forEach((area, index) => {
    const position = index + 2;
    footer[`${position}_link`] = getRoomHash(area);
    footer[`${position}_name`] = area.name;
    footer[`${position}_icon`] = area.icon || "mdi:home-outline";
  });
  return footer;
}

// src/cards/entity-cards.ts
function groupRoomEntities(entities) {
  const groupDefinitions = [
    {
      title: "Lights",
      icon: "mdi:lightbulb-group",
      domains: ["light", "switch", "input_boolean"],
      columns: 2
    },
    {
      title: "Climate",
      icon: "mdi:thermostat",
      domains: ["climate", "fan", "humidifier"],
      columns: 2
    },
    {
      title: "Media",
      icon: "mdi:speaker",
      domains: ["media_player"],
      columns: 2
    },
    {
      title: "Covers",
      icon: "mdi:window-shutter",
      domains: ["cover"],
      columns: 1
    },
    {
      title: "Scenes",
      icon: "mdi:palette",
      domains: ["scene", "script", "button"],
      columns: 2
    },
    {
      title: "Devices",
      icon: "mdi:power-plug",
      domains: ["alarm_control_panel", "lock", "select", "vacuum"],
      columns: 2
    }
  ];
  return groupDefinitions.map((definition) => ({
    ...definition,
    entities: entities.filter((entity) => definition.domains.includes(getDomain(entity.entity_id)))
  }));
}
function entityCardTemplate(domain) {
  if (domain === "media_player") {
    return { type: "custom:bubble-card", card_type: "media-player" };
  }
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      button_type: ["scene", "script", "button"].includes(domain) ? "name" : "switch"
    };
  }
  return { type: "custom:bubble-card", card_type: cardType };
}
function entityToCard(entity, options, sonosEntities = []) {
  const domain = getDomain(entity.entity_id);
  if (domain === "media_player") {
    return mediaPlayerToCard(entity.entity_id, options, sonosEntities);
  }
  return entityToBubbleCard(entity);
}
function entityToBubbleCard(entity) {
  const domain = getDomain(entity.entity_id);
  const cardType = DOMAIN_CARD_TYPES[domain] || "button";
  if (cardType === "button") {
    return {
      type: "custom:bubble-card",
      card_type: "button",
      entity: entity.entity_id,
      button_type: ["scene", "script", "button"].includes(domain) ? "name" : "switch"
    };
  }
  return {
    type: "custom:bubble-card",
    card_type: cardType,
    entity: entity.entity_id
  };
}

// src/views/area-view.ts
function buildAreaView(area, entities, devices, hass, options) {
  const cards = getAreaEntities(area.area_id, entities, devices, hass, options).slice(0, options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA).map((entity) => entityToCard(entity, options));
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
  const showCameraButton = options.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON;
  return {
    type: "horizontal-stack",
    cards: [
      subButtonBar([profileSubButton(hass, options)], "flex-start"),
      subButtonBar(
        [
          ...showCameraButton ? [navigationSubButton("Cameras", "mdi:video", "#cameras")] : []
        ],
        "center"
      ),
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

// src/cards/auto-entities.ts
function autoEntitiesGrid(columns, include) {
  return {
    type: "custom:auto-entities",
    card: {
      type: "grid",
      square: false,
      columns
    },
    card_param: "cards",
    show_empty: false,
    filter: {
      include
    },
    sort: {
      method: "friendly_name"
    }
  };
}

// src/views/theme-views.ts
var DOMAIN_STATE_BUCKETS = {
  light: { on: ["on"], off: ["off"] },
  cover: { on: ["open"], off: ["closed"] },
  climate: { on: ["heat", "cool", "heat_cool", "auto", "dry", "fan_only"], off: ["off"] },
  fan: { on: ["on"], off: ["off"] },
  humidifier: { on: ["on"], off: ["off"] },
  media_player: { on: ["playing", "paused", "on"], off: ["idle", "standby", "off"] }
};
var THEME_DEFINITIONS = [
  {
    id: "lights",
    title: "Lights",
    icon: "mdi:lightbulb-group",
    domains: ["light"],
    columns: 2
  },
  {
    id: "covers",
    title: "Covers",
    icon: "mdi:window-shutter",
    domains: ["cover"],
    columns: 1
  },
  {
    id: "climate",
    title: "Climate",
    icon: "mdi:thermostat",
    domains: ["climate", "fan", "humidifier"],
    columns: 2
  },
  {
    id: "media",
    title: "Media",
    icon: "mdi:speaker",
    domains: ["media_player"],
    columns: 2
  }
];
function getActiveThemes(areas, entities, devices, hass, options) {
  return THEME_DEFINITIONS.map((theme) => {
    const entries = [];
    areas.forEach((area) => {
      getAreaEntities(area.area_id, entities, devices, hass, options).filter((entity) => theme.domains.includes(getDomain(entity.entity_id))).forEach((entity) => entries.push({ area, entity }));
    });
    return { ...theme, entries };
  }).filter((theme) => theme.entries.length > 0);
}
function buildThemeNavigation(themes) {
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
              navigation_path: `#${theme.id}`
            }
          }))
        }
      ]
    }
  };
}
function buildThemePopups(themes, hass, options, sonosEntities = []) {
  const grouping = options.theme_grouping ?? DEFAULT_THEME_GROUPING;
  return themes.map((theme) => buildThemePopup(theme, grouping, hass, options, sonosEntities));
}
function buildThemePopup(theme, grouping, hass, options, sonosEntities) {
  const cards = grouping === "state" ? buildStateGroupedCards(theme) : buildStaticGroupedCards(theme, grouping, hass, options, sonosEntities);
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
    cards
  };
}
function buildStateGroupedCards(theme) {
  return [
    bubbleSeparator("On", "mdi:toggle-switch"),
    autoEntitiesGrid(theme.columns, buildStateIncludes(theme.domains, "on")),
    bubbleSeparator("Off", "mdi:toggle-switch-off-outline"),
    autoEntitiesGrid(theme.columns, buildStateIncludes(theme.domains, "off"))
  ];
}
function buildStateIncludes(domains, bucket) {
  return domains.flatMap(
    (domain) => (DOMAIN_STATE_BUCKETS[domain]?.[bucket] ?? []).map((state) => ({
      domain,
      state,
      options: entityCardTemplate(domain)
    }))
  );
}
function buildStaticGroupedCards(theme, grouping, hass, options, sonosEntities) {
  const sections = groupThemeEntries(theme, grouping, hass);
  const cards = [];
  sections.forEach((section) => {
    if (section.title) {
      cards.push(bubbleSeparator(section.title, section.icon));
    }
    cards.push({
      type: "grid",
      square: false,
      columns: theme.columns,
      cards: section.entities.map((entity) => entityToCard(entity, options, sonosEntities))
    });
  });
  return cards;
}
function groupThemeEntries(theme, grouping, hass) {
  if (grouping === "none") {
    const entities = [...theme.entries].map((entry) => entry.entity).sort((left, right) => getFriendlyName(left, hass).localeCompare(getFriendlyName(right, hass)));
    return [{ title: null, icon: "", entities }];
  }
  const sections = [];
  const indexByArea = /* @__PURE__ */ new Map();
  theme.entries.forEach((entry) => {
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

// src/views/home-view.ts
function buildHomeView(areas, entities, devices, hass, options, sonosEntities = []) {
  const activeThemes = getActiveThemes(areas, entities, devices, hass, options);
  const overviewCards = buildOverviewCards(hass);
  return {
    type: "sections",
    max_columns: 2,
    sections: [
      {
        type: "grid",
        cards: [
          buildTopNavigation(hass, options),
          ...overviewCards.length ? [
            {
              type: "grid",
              square: false,
              columns: 2,
              cards: overviewCards
            }
          ] : [],
          ...activeThemes.length ? [buildThemeNavigation(activeThemes)] : [],
          ...buildRoomsSection(areas, entities, devices),
          ...areas.map((area) => buildRoomPopup(area, entities, devices, hass, options, sonosEntities)),
          ...buildThemePopups(activeThemes, hass, options, sonosEntities)
        ]
      }
    ]
  };
}
function buildOverviewCards(hass) {
  const weather = findFirstStateEntity(hass, ["weather"]);
  const vacuums = findStateEntities(hass, ["vacuum"]).slice(0, 2);
  return [
    ...weather ? [
      fixedHomeCard({
        type: "weather-forecast",
        entity: weather,
        forecast_type: "daily"
      })
    ] : [],
    ...vacuums.map(
      (entity) => fixedHomeCard({
        type: "custom:bubble-card",
        card_type: "button",
        button_type: "state",
        entity,
        sub_button: [
          {
            entity,
            icon: "mdi:play",
            tap_action: {
              action: "call-service",
              service: "vacuum.start",
              target: {
                entity_id: entity
              }
            }
          }
        ]
      })
    )
  ];
}
function buildRoomsSection(areas, entities, devices) {
  return [
    bubbleSeparator("Rooms", "mdi:floor-plan"),
    {
      type: "grid",
      square: false,
      columns: 2,
      cards: areas.map((area) => {
        const primaryEntity = findPrimaryEntityForArea(area.area_id, entities, devices);
        return buttonToHash(
          area.name,
          area.icon || "mdi:home-outline",
          getRoomHash(area),
          primaryEntity?.entity_id
        );
      })
    }
  ];
}
function buildRoomPopup(area, entities, devices, hass, options, sonosEntities = []) {
  const areaEntities = getAreaEntities(area.area_id, entities, devices, hass, options).slice(
    0,
    options.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA
  );
  const groups = groupRoomEntities(areaEntities);
  const cards = [];
  groups.forEach((group) => {
    if (!group.entities.length) {
      return;
    }
    cards.push(bubbleSeparator(group.title, group.icon));
    cards.push({
      type: "grid",
      square: false,
      columns: group.columns,
      cards: group.entities.map((entity) => entityToCard(entity, options, sonosEntities))
    });
  });
  if (!cards.length) {
    cards.push({
      type: "markdown",
      content: "No visible entities found for this area."
    });
  }
  return {
    type: "custom:bubble-card",
    card_type: "pop-up",
    hash: getRoomHash(area),
    name: area.name,
    icon: area.icon || "mdi:home-outline",
    popup_mode: "centered",
    width_desktop: "680px",
    bg_opacity: "85",
    bg_blur: "12",
    show_previous_button: true,
    close_by_clicking_outside: true,
    cards
  };
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
            options: config,
            sonosEntities: getSonosMediaPlayers(entities, config)
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
        options,
        config.sonosEntities
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
