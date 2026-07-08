import {
  DEFAULT_ENABLE_SONOS_GROUPING,
  DEFAULT_MAX_ENTITIES_PER_AREA,
  DEFAULT_MEDIA_PLAYER_CARD,
  DEFAULT_ROOM_ORDER,
  DEFAULT_SHOW_CAMERA_BUTTON,
  DEFAULT_THEME_GROUPING,
} from "./constants";
import type { HassArea, HomeAssistant, MediaPlayerCardType, RoomOrder, StrategyConfig, ThemeGrouping } from "./types";
import { getMediaPlayerCardType } from "./cards/media-player";
import { getRegistries } from "./registry";
import { getActiveAreas, sortAreas } from "./utils/entities";
import { clampNumber, escapeHtml } from "./utils/format";

export class BubbleCardDashboardStrategyEditor extends HTMLElement {
  private _config: StrategyConfig = {};
  private _hass?: HomeAssistant;
  private _areas: HassArea[] = [];
  private _areasLoaded = false;
  private _areasLoading = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.loadAreas();
    this.render();
  }

  setConfig(config: StrategyConfig) {
    this._config = {
      media_player_card: DEFAULT_MEDIA_PLAYER_CARD,
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      show_camera_button: DEFAULT_SHOW_CAMERA_BUTTON,
      enable_sonos_grouping: DEFAULT_ENABLE_SONOS_GROUPING,
      theme_grouping: DEFAULT_THEME_GROUPING,
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

    if (field === "show_camera_button" || field === "enable_sonos_grouping") {
      this.updateConfig(field, (target as HTMLInputElement).checked);
      return;
    }

    if (field === "room_order") {
      this.updateConfig(field, target.value);
      this.render();
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

function themeGroupingOption(value: ThemeGrouping, label: string, selectedValue: ThemeGrouping): string {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}

function roomOrderOption(value: RoomOrder, label: string, selectedValue: RoomOrder): string {
  return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
}
