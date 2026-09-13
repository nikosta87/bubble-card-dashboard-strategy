// Adaptive Home Surface design system. Visual state is semantic: color is used
// to explain what the home is doing, not as decoration.

export const DESIGN = {
  popup: { widthDesktop: "540px", bgOpacity: "92", bgBlur: "14" },
  cardLayout: { alarm: "large-2-rows", lock: "large-2-rows" },
};

const THEME_TOKENS: Record<string, string> = {
  "--bcds-accent": "var(--primary-color)",
  "--bcds-radius": "var(--ha-card-border-radius, 22px)",
  "--bcds-surface": "var(--ha-card-background, var(--card-background-color))",
  "--bcds-positive": "var(--success-color, #43a047)",
  "--bcds-warning": "var(--warning-color, #ffa000)",
  "--bcds-critical": "var(--error-color, #db4437)",
};

const BUBBLE_BINDINGS: Record<string, string> = {
  "--bubble-accent-color": "var(--bcds-accent)",
  "--bubble-border-radius": "var(--bcds-radius)",
};

export function bubbleThemeStyles(): string {
  const declarations = [...Object.entries(THEME_TOKENS), ...Object.entries(BUBBLE_BINDINGS)]
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `ha-card {\n${declarations}\n}`;
}

/** Tint an active light with its real RGB/Kelvin color. */
export function bubbleLightSurfaceStyles(): string {
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

/**
 * Room cards sample all active lights in the area and blend them into one calm
 * ambient surface. This mirrors the actual room without turning the overview
 * into a rainbow. The entity list is fixed at generation time; state values are
 * read reactively by Bubble Card's template.
 */
export function bubbleRoomAmbientStyles(lightEntityIds: string[], intensity: "subtle" | "balanced" | "vivid" = "balanced"): string {
  const ids = JSON.stringify(lightEntityIds);
  const alpha = intensity === "subtle" ? 0.12 : intensity === "vivid" ? 0.28 : 0.20;
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
