import {
  DEFAULT_BATTERY_CRITICAL_BELOW, DEFAULT_BATTERY_LOW_BELOW, DEFAULT_ENABLE_ADVANCED_CONTROLS,
  DEFAULT_HIDE_MOBILE_APP_BATTERIES, DEFAULT_MAX_ENTITIES_PER_AREA, DEFAULT_ROOM_ORDER, DEFAULT_SHOW_ALARM_CONTROLS,
} from "./constants";
import type { HassArea, HomeAssistant, RoomOrder, StrategyConfig, ThemeGrouping } from "./types";
import { getRegistries } from "./registry";
import { getActiveAreas, sortAreas } from "./utils/entities";
import { clampNumber, escapeHtml } from "./utils/format";

const BOOLEAN_FIELDS = new Set([
  "enable_advanced_controls", "show_light_summary", "show_security_summary", "show_climate_summary",
  "show_battery_summary", "show_alarm_controls", "hide_mobile_app_batteries", "ambient_room_colors",
  "artwork_media_surface", "contextual_home_cards",
]);
const STORAGE_KEY = "bcds-editor-expanded-panels";

export class BubbleCardDashboardStrategyEditor extends HTMLElement {
  private _config: StrategyConfig = {};
  private _hass?: HomeAssistant;
  private _areas: HassArea[] = [];
  private _areasLoaded = false;
  private _areasLoading = false;
  private _rendered = false;
  private _expanded = loadExpandedPanels();

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.loadAreas();
    if (!this._rendered) this.render();
  }

  setConfig(config: StrategyConfig) {
    this._config = {
      max_entities_per_area: DEFAULT_MAX_ENTITIES_PER_AREA,
      enable_advanced_controls: DEFAULT_ENABLE_ADVANCED_CONTROLS,
      room_order: DEFAULT_ROOM_ORDER,
      ...config,
    };
    this.render();
  }

  connectedCallback() { this.render(); }

  private async loadAreas() {
    if (!this._hass || this._areasLoaded || this._areasLoading) return;
    this._areasLoading = true;
    try {
      const { areas, devices, entities } = await getRegistries(this._hass);
      this._areas = getActiveAreas(areas, entities, devices);
      this._areasLoaded = true;
      this.render();
    } catch { /* retry on the next hass update */ }
    finally { this._areasLoading = false; }
  }

  private orderedAreasForDisplay(): HassArea[] {
    return sortAreas(this._areas, this._config.room_order ?? DEFAULT_ROOM_ORDER, this._config.custom_room_order ?? []);
  }

  private panel(key: string, icon: string, title: string, description: string, body: string): string {
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

  private field(label: string, control: string, hint = ""): string {
    return `<div class="field"><label>${label}</label><div class="control">${control}${hint ? `<div class="hint">${hint}</div>` : ""}</div></div>`;
  }

  private toggle(field: string, checked: boolean): string {
    return `<label class="switch"><input data-field="${field}" type="checkbox" ${checked ? "checked" : ""}><span></span></label>`;
  }

  private render() {
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
      this.field("Media artwork surfaces", this.toggle("artwork_media_surface", artwork), "Use media artwork as the visual surface when supported by Bubble Card."),
    ].join("");

    const home = [
      this.field("Contextual hero", `<select data-field="home_hero_mode"><option value="adaptive" ${hero === "adaptive" ? "selected" : ""}>Adaptive</option><option value="media" ${hero === "media" ? "selected" : ""}>Media first</option><option value="weather" ${hero === "weather" ? "selected" : ""}>Weather first</option><option value="none" ${hero === "none" ? "selected" : ""}>None</option></select>`, "Adaptive prioritizes what deserves attention now instead of showing a fixed catalogue."),
      this.field("Hide inactive context cards", this.toggle("contextual_home_cards", contextual), "Keep Home calm: idle vacuums and inactive media stay out of the primary surface."),
      this.field("Profile image", `<input data-field="profile_image" type="text" value="${escapeHtml(this._config.profile_image || "")}" placeholder="/local/profile.jpg">`),
    ].join("");

    const rooms = [
      this.field("Max entities per room", `<input data-field="max_entities_per_area" type="number" min="1" max="100" value="${maxEntities}">`, "Complex controls are full width; simple actions use two columns."),
      this.field("Room order", `<select data-field="room_order">${roomOrderOption("home_assistant", "Home Assistant order", roomOrder)}${roomOrderOption("alphabetical", "Alphabetical", roomOrder)}${roomOrderOption("custom", "Custom", roomOrder)}</select>`),
      this.renderRoomList(roomOrder),
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
      this.field("Group entities by", `<select data-field="theme_grouping">${themeGroupingOption("auto", "Automatic", themeGrouping)}${themeGroupingOption("area", "Room", themeGrouping)}${themeGroupingOption("state", "State", themeGrouping)}${themeGroupingOption("none", "No grouping", themeGrouping)}</select>`),
    ].join("");

    const advancedBody = [
      this.field("Advanced Bubble controls", this.toggle("enable_advanced_controls", advanced), "Enable capability-aware sliders/selects for compatible entities."),
      this.field("Dashboard title", `<input data-field="title" type="text" value="${escapeHtml(this._config.title || "")}" placeholder="${escapeHtml(this._hass?.config.location_name || "Bubble Card Dashboard")}">`, "Leave empty to use the Home Assistant location name."),
    ].join("");

    this.innerHTML = `<style>
      :host{display:block;color:var(--primary-text-color);font:inherit}.editor{display:grid;gap:12px;max-width:820px;margin:auto}.intro{padding:4px 4px 10px}.intro h2{margin:0 0 6px;font-size:20px}.intro p{margin:0;color:var(--secondary-text-color);line-height:1.45}
      .group-label{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--secondary-text-color);margin:18px 4px 2px}.panel{border:1px solid var(--divider-color);border-radius:16px;background:var(--card-background-color);overflow:hidden}.panel-header{width:100%;display:flex;align-items:center;gap:14px;padding:16px;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.panel-header>ha-icon:first-child{color:var(--primary-color)}.panel-heading{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.panel-heading small{font-weight:400;color:var(--secondary-text-color);white-space:normal}.chevron{transition:transform .18s ease}.expanded .chevron{transform:rotate(180deg)}.panel-body{padding:0 16px 16px;border-top:1px solid var(--divider-color)}
      .field{display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:20px;align-items:start;padding:15px 0;border-bottom:1px solid color-mix(in srgb,var(--divider-color) 65%,transparent)}.field:last-child{border-bottom:0}.field>label{font-weight:500;padding-top:9px}.control{min-width:0}.hint{font-size:12px;line-height:1.4;color:var(--secondary-text-color);margin-top:7px}input,select{width:100%;box-sizing:border-box;border:1px solid var(--divider-color);border-radius:10px;background:var(--secondary-background-color);color:var(--primary-text-color);font:inherit;padding:10px 12px}
      .switch{display:inline-flex!important;padding:0!important}.switch input{position:absolute;opacity:0;width:1px}.switch span{width:44px;height:24px;border-radius:14px;background:var(--disabled-color);position:relative;transition:.18s}.switch span:after{content:"";position:absolute;width:18px;height:18px;border-radius:50%;background:white;top:3px;left:3px;transition:.18s}.switch input:checked+span{background:var(--primary-color)}.switch input:checked+span:after{transform:translateX(20px)}
      .room-list{grid-column:1/-1;border:1px solid var(--divider-color);border-radius:12px;overflow:hidden;margin-top:8px}.room-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--divider-color)}.room-row:last-child{border:0}.room-row input{width:auto}.room-name{flex:1}.room-actions{display:flex;gap:6px}.room-actions button{width:34px;height:34px;border:1px solid var(--divider-color);border-radius:9px;background:var(--secondary-background-color);color:inherit}.room-empty{padding:12px;color:var(--secondary-text-color)}
      @media(max-width:640px){.field{grid-template-columns:1fr;gap:7px}.field>label{padding-top:0}.panel-header{padding:14px}.panel-heading small{font-size:12px}}
    </style><div class="editor"><div class="intro"><h2>Bubble Card Dashboard</h2><p>Adaptive Home Surface — configure what the household sees, not individual Home Assistant implementation details.</p></div>
      <div class="group-label">Experience</div>${this.panel("appearance","mdi:palette-outline","Appearance","Color, ambience and visual personality",appearance)}${this.panel("home","mdi:home-lightning-bolt-outline","Home","Contextual overview and navigation",home)}
      <div class="group-label">Spaces & controls</div>${this.panel("rooms","mdi:floor-plan","Rooms","Room visibility, order and popup density",rooms)}${this.panel("summaries","mdi:view-dashboard-outline","Global controls","Lights, security, climate and maintenance",summaries)}
      <div class="group-label">Advanced</div>${this.panel("advanced","mdi:tune-variant","Advanced","Bubble controls and dashboard metadata",advancedBody)}
    </div>`;

    this.querySelectorAll("[data-panel]").forEach((el) => el.addEventListener("click", (event) => this.togglePanel((event.currentTarget as HTMLElement).dataset.panel || "")));
    this.querySelectorAll("[data-field]").forEach((el) => { el.addEventListener("change", (event) => this.handleChange(event)); el.addEventListener("input", (event) => this.handleInput(event)); });
    this.querySelectorAll("[data-room-visible]").forEach((el) => el.addEventListener("change", (event) => this.handleRoomVisibility(event)));
    this.querySelectorAll("[data-room-move]").forEach((el) => el.addEventListener("click", (event) => this.handleRoomMove(event)));
  }

  private togglePanel(key: string) {
    if (!key) return;
    this._expanded.has(key) ? this._expanded.delete(key) : this._expanded.add(key);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...this._expanded])); } catch { /* session only */ }
    this.render();
  }

  private renderRoomList(roomOrder: RoomOrder): string {
    if (!this._areasLoaded) return `<div class="room-list"><div class="room-empty">Loading rooms…</div></div>`;
    if (!this._areas.length) return `<div class="room-list"><div class="room-empty">No rooms with entities found.</div></div>`;
    const hidden = new Set(this._config.hidden_areas ?? []);
    const ordered = this.orderedAreasForDisplay();
    return `<div class="room-list">${ordered.map((area,index) => `<div class="room-row"><input type="checkbox" data-room-visible="${escapeHtml(area.area_id)}" ${hidden.has(area.area_id) ? "" : "checked"}><span class="room-name">${escapeHtml(area.name)}</span>${roomOrder === "custom" ? `<span class="room-actions"><button type="button" data-room-move="up" data-area="${escapeHtml(area.area_id)}" ${index===0?"disabled":""}>↑</button><button type="button" data-room-move="down" data-area="${escapeHtml(area.area_id)}" ${index===ordered.length-1?"disabled":""}>↓</button></span>`:""}</div>`).join("")}</div>`;
  }

  private handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.dataset.field === "title" || target.dataset.field === "profile_image") this.updateConfig(target.dataset.field, target.value || undefined);
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = target.dataset.field;
    if (!field || field === "title" || field === "profile_image") return;
    if (field === "max_entities_per_area" || field === "battery_critical_below" || field === "battery_low_below") { this.updateConfig(field, clampNumber(Number(target.value),1,100)); return; }
    if (BOOLEAN_FIELDS.has(field)) { this.updateConfig(field,(target as HTMLInputElement).checked); return; }
    if (field === "room_order") { this.updateConfig(field,target.value); this.render(); return; }
    if (field === "theme_grouping") { this.updateConfig(field,target.value === "auto" ? undefined : target.value); return; }
    this.updateConfig(field,target.value);
  }

  private handleRoomVisibility(event: Event) {
    const target = event.target as HTMLInputElement; const id = target.dataset.roomVisible; if (!id) return;
    const hidden = new Set(this._config.hidden_areas ?? []); target.checked ? hidden.delete(id) : hidden.add(id);
    const list=[...hidden]; this.updateConfig("hidden_areas",list.length?list:undefined);
  }

  private handleRoomMove(event: Event) {
    const target=event.currentTarget as HTMLButtonElement; const id=target.dataset.area; const dir=target.dataset.roomMove;
    if(!id||(dir!=="up"&&dir!=="down"))return; const order=this.orderedAreasForDisplay().map(a=>a.area_id); const i=order.indexOf(id); const j=dir==="up"?i-1:i+1;
    if(i===-1||j<0||j>=order.length)return; [order[i],order[j]]=[order[j],order[i]]; this.updateConfig("custom_room_order",order); this.render();
  }

  private updateConfig(field: string,value: unknown) {
    const next={...this._config,[field]:value}; if(value===undefined||value==="") delete next[field as keyof StrategyConfig]; this._config=next;
    this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:next},bubbles:true,composed:true}));
  }
}

function loadExpandedPanels(): Set<string> { try { const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); if(Array.isArray(parsed)) return new Set(parsed.filter(v=>typeof v==="string")); } catch {} return new Set(["appearance","home"]); }
function themeGroupingOption(value: ThemeGrouping|"auto",label:string,selected:string):string{return `<option value="${value}" ${value===selected?"selected":""}>${label}</option>`;}
function roomOrderOption(value:RoomOrder,label:string,selected:RoomOrder):string{return `<option value="${value}" ${value===selected?"selected":""}>${label}</option>`;}
