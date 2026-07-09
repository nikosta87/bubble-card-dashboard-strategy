import {
  DEFAULT_BATTERY_CRITICAL_BELOW,
  DEFAULT_ENABLE_SONOS_GROUPING,
  DEFAULT_HIDE_MOBILE_APP_BATTERIES,
  DEFAULT_MAX_ENTITIES_PER_AREA,
  DEFAULT_MEDIA_PLAYER_CARD,
  DEFAULT_ROOM_ORDER,
  DEFAULT_SHOW_CAMERA_BUTTON,
  DEFAULT_SUMMARY_COLUMNS,
} from "./constants";
import type { HassArea, HomeAssistant, MediaPlayerCardType, RoomOrder, StrategyConfig, ThemeGrouping } from "./types";
import { getMediaPlayerCardType } from "./cards/media-player";
import { getRegistries } from "./registry";
import { getActiveAreas, sortAreas } from "./utils/entities";
import { clampNumber, escapeHtml } from "./utils/format";

const BOOLEAN_FIELDS = new Set([
  "show_camera_button",
  "enable_sonos_grouping",
  "show_light_summary",
  "show_security_summary",
  "show_climate_summary",
  "show_battery_summary",
  "hide_mobile_app_batteries",
]);

export class BubbleCardDashboardStrategyEditor extends HTMLElement {
  private _config: StrategyConfig = {};
  private _hass?: HomeAssistant;
  private _areas: HassArea[] = [];
  private _areasLoaded = false;
  private _areasLoading = false;
  private _rendered = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.loadAreas();

    // Only render on the first hass assignment. Home Assistant pushes a new hass
    // object on every state change; re-rendering here would rebuild the form and
    // close any open <select> dropdown the moment the user clicks it.
    if (!this._rendered) {
      this.render();
    }
  }

  setConfig(config: StrategyConfig) {
    this._config = {
      media_player_card: DEFAULT_MEDIA_PLAYER_CARD,
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      show_camera_button: DEFAULT_SHOW_CAMERA_BUTTON,
      enable_sonos_grouping: DEFAULT_ENABLE_SONOS_GROUPING,
      room_order: DEFAULT_ROOM_ORDER,
      ...config,
    };
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private async loadAreas() {
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
      // Ignore; the next hass update retries the load.
    } finally {
      this._areasLoading = false;
    }
  }

  private orderedAreasForDisplay(): HassArea[] {
    return sortAreas(this._areas, this._config.room_order ?? DEFAULT_ROOM_ORDER, this._config.custom_room_order ?? []);
  }

  private render() {
    this._rendered = true;
    const mediaPlayerCard = getMediaPlayerCardType(this._config);
    const maxEntities = this._config.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
    const showCameraButton = this._config.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON;
    const enableSonosGrouping = this._config.enable_sonos_grouping ?? DEFAULT_ENABLE_SONOS_GROUPING;
    const themeGrouping = this._config.theme_grouping ?? "auto";
    const roomOrder = this._config.room_order ?? DEFAULT_ROOM_ORDER;
    const summaryColumns = this._config.summary_columns ?? DEFAULT_SUMMARY_COLUMNS;
    const showLightSummary = this._config.show_light_summary ?? true;
    const showSecuritySummary = this._config.show_security_summary ?? true;
    const showClimateSummary = this._config.show_climate_summary ?? true;
    const showBatterySummary = this._config.show_battery_summary ?? true;
    const hideMobileBatteries = this._config.hide_mobile_app_batteries ?? DEFAULT_HIDE_MOBILE_APP_BATTERIES;
    const batteryCritical = this._config.battery_critical_below ?? DEFAULT_BATTERY_CRITICAL_BELOW;

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
        <div class="section-title">Summaries</div>
        <div class="field">
          <label>Summary layout</label>
          <div class="radio-group">
            <label><input type="radio" name="summary_columns" data-field="summary_columns" value="1" ${summaryColumns === 1 ? "checked" : ""}> 1 column (full width)</label>
            <label><input type="radio" name="summary_columns" data-field="summary_columns" value="2" ${summaryColumns === 2 ? "checked" : ""}> 2 columns (2x2 grid)</label>
            <label><input type="radio" name="summary_columns" data-field="summary_columns" value="4" ${summaryColumns === 4 ? "checked" : ""}> 4 columns (1x4 row)</label>
          </div>
          <div class="hint">Choose how the summary tiles are arranged. Fewer columns give each tile more width so long names stay readable. The layout adjusts automatically when summaries are hidden.</div>
        </div>
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

  private renderRoomList(roomOrder: RoomOrder): string {
    if (!this._areasLoaded) {
      return `<div class="room-list"><div class="room-empty">Loading rooms…</div></div>`;
    }

    if (!this._areas.length) {
      return `<div class="room-list"><div class="room-empty">No rooms with entities found.</div></div>`;
    }

    const hiddenAreas = new Set(this._config.hidden_areas ?? []);
    const orderedAreas = this.orderedAreasForDisplay();
    const showMoveButtons = roomOrder === "custom";

    const rows = orderedAreas
      .map((area, index) => {
        const areaId = escapeHtml(area.area_id);
        const actions = showMoveButtons
          ? `<span class="room-actions">
              <button type="button" data-room-move="up" data-area="${areaId}" ${index === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
              <button type="button" data-room-move="down" data-area="${areaId}" ${index === orderedAreas.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
            </span>`
          : "";

        return `
          <div class="room-row">
            <input type="checkbox" data-room-visible="${areaId}" ${hiddenAreas.has(area.area_id) ? "" : "checked"}>
            <span class="room-name">${escapeHtml(area.name)}</span>
            ${actions}
          </div>`;
      })
      .join("");

    return `<div class="room-list">${rows}</div>`;
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;

    if (target.dataset.field === "title" || target.dataset.field === "profile_image") {
      this.updateConfig(target.dataset.field, target.value || undefined);
    }
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = target.dataset.field;

    if (!field || field === "title") {
      return;
    }

    if (field === "max_entities_per_area") {
      this.updateConfig(field, clampNumber(Number(target.value), 1, 100));
      return;
    }

    if (field === "battery_critical_below") {
      this.updateConfig(field, clampNumber(Number(target.value), 1, 100));
      return;
    }

    if (field === "summary_columns") {
      this.updateConfig(field, Number(target.value));
      return;
    }

    if (BOOLEAN_FIELDS.has(field)) {
      this.updateConfig(field, (target as HTMLInputElement).checked);
      return;
    }

    if (field === "room_order") {
      this.updateConfig(field, target.value);
      this.render();
      return;
    }

    if (field === "theme_grouping") {
      // "auto" means no explicit grouping, so each summary uses its own default.
      this.updateConfig(field, target.value === "auto" ? undefined : target.value);
      return;
    }

    this.updateConfig(field, target.value);
  }

  private handleRoomVisibility(event: Event) {
    const target = event.target as HTMLInputElement;
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
    this.updateConfig("hidden_areas", hiddenList.length ? hiddenList : undefined);
  }

  private handleRoomMove(event: Event) {
    const target = event.currentTarget as HTMLButtonElement;
    const areaId = target.dataset.area;
    const direction = target.dataset.roomMove;

    if (!areaId || (direction !== "up" && direction !== "down")) {
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

  private updateConfig(field: string, value: unknown) {
    const nextConfig = {
      ...this._config,
      [field]: value,
    };

    if (value === undefined || value === "") {
      delete nextConfig[field as keyof StrategyConfig];
    }

    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: {
          config: nextConfig,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

function mediaPlayerCardOption(value: MediaPlayerCardType, label: string, selectedValue: MediaPlayerCardType): string {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

function themeGroupingOption(value: ThemeGrouping | "auto", label: string, selectedValue: string): string {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

function roomOrderOption(value: RoomOrder, label: string, selectedValue: RoomOrder): string {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}
