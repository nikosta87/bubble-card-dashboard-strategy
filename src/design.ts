// Central design system. Every visual value lives here so nothing is hardcoded
// in the view builders and the whole dashboard can be retuned from one place.

export const DESIGN = {
  popup: {
    widthDesktop: "540px",
    bgOpacity: "92",
    bgBlur: "14",
  },
  // card_layout for cards whose sub-buttons should sit on a second row instead of
  // inline with the name.
  cardLayout: {
    alarm: "large-2-rows",
    lock: "large-2-rows",
  },
};

// CSS custom properties layered on top of the active Home Assistant theme. Cards
// point Bubble Card's own variables at these tokens, so re-theming the dashboard
// only means overriding the tokens here (or in a HA theme).
const THEME_TOKENS: Record<string, string> = {
  "--bcds-accent": "var(--primary-color)",
  "--bcds-radius": "var(--ha-card-border-radius, 18px)",
};

// Maps our tokens onto the Bubble Card variables they should drive.
const BUBBLE_BINDINGS: Record<string, string> = {
  "--bubble-accent-color": "var(--bcds-accent)",
  "--bubble-border-radius": "var(--bcds-radius)",
};

/**
 * Returns the shared Bubble Card `styles` block that publishes the design tokens
 * and binds them to Bubble Card's variables. Applied to pop-ups (cascades to
 * their children) and to the summary tiles.
 */
export function bubbleThemeStyles(): string {
  const declarations = [...Object.entries(THEME_TOKENS), ...Object.entries(BUBBLE_BINDINGS)]
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");

  return `ha-card {\n${declarations}\n}`;
}

/**
 * Bubble Card already uses a light's RGB color for its icon and slider. This
 * adds a subtle surface tint and extends the behavior to white-temperature-only
 * lights. Because this is a Bubble JS template it also works when auto-entities
 * injects the entity at runtime.
 */
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
