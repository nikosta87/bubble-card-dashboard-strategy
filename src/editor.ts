import {
  DEFAULT_ENABLE_SONOS_GROUPING,
  DEFAULT_MAX_ENTITIES_PER_AREA,
  DEFAULT_MEDIA_PLAYER_CARD,
  DEFAULT_SHOW_CAMERA_BUTTON,
} from "./constants";
import type { HomeAssistant, MediaPlayerCardType, StrategyConfig } from "./types";
import { getMediaPlayerCardType } from "./cards/media-player";
import { clampNumber, escapeHtml } from "./utils/format";

export class BubbleCardDashboardStrategyEditor extends HTMLElement {
  private _config: StrategyConfig = {};
  private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.render();
  }

  setConfig(config: StrategyConfig) {
    this._config = {
      media_player_card: DEFAULT_MEDIA_PLAYER_CARD,
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      show_camera_button: DEFAULT_SHOW_CAMERA_BUTTON,
      enable_sonos_grouping: DEFAULT_ENABLE_SONOS_GROUPING,
      ...config,
    };
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    const mediaPlayerCard = getMediaPlayerCardType(this._config);
    const maxEntities = this._config.max_entities_per_area ?? DEFAULT_MAX_ENTITIES_PER_AREA;
    const showCameraButton = this._config.show_camera_button ?? DEFAULT_SHOW_CAMERA_BUTTON;
    const enableSonosGrouping = this._config.enable_sonos_grouping ?? DEFAULT_ENABLE_SONOS_GROUPING;

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
      </div>
    `;

    this.querySelectorAll("[data-field]").forEach((element) => {
      element.addEventListener("change", (event) => this.handleChange(event));
      element.addEventListener("input", (event) => this.handleInput(event));
    });
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

    this.updateConfig(field, target.value);
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
