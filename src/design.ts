// Central design system. Every visual value lives here so nothing is hardcoded
// in the view builders and the whole dashboard can be retuned from one place.

export const DESIGN = {
  popup: {
    widthDesktop: "540px",
    bgOpacity: "92",
    bgBlur: "14",
  },
  homeCard: {
    height: "190px",
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
