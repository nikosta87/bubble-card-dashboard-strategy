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
  // Bubble Card row heights for cards that benefit from more vertical space than
  // the default single row.
  cardRows: {
    mediaPlayer: 4,
  },
  // card_layout for cards whose sub-buttons should sit on a second row instead of
  // inline with the name.
  cardLayout: {
    alarm: "large-2-rows",
    lock: "large-2-rows",
  },
  // card_layout per summary-tile column count: wider layouts get more presence,
  // denser layouts stay compact so they never grow too large.
  summaryTileLayout: {
    1: "large",
    2: "large",
    4: "normal",
  } as Record<number, string>,
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

/** card_layout for a summary tile given the configured column count. */
export function summaryTileLayout(columns: number): string {
  return DESIGN.summaryTileLayout[columns] ?? "normal";
}

const COUNTER_SELECTOR = "card.querySelector('.bubble-sub-button-1')";

/**
 * Bubble Card only evaluates `${...}` templates inside the `styles` block, so the
 * live counter is written into the tile's first sub-button from there. Combines
 * the shared theme styles with the counter template (which must come last, as
 * Bubble Card requires non-CSS templates at the end). Falls back to theme-only
 * styles when a tile has no counter.
 */
export function tileStyles(counterExpression?: string): string {
  const base = bubbleThemeStyles();

  if (!counterExpression) {
    return base;
  }

  const write = `\${${COUNTER_SELECTOR} && (${COUNTER_SELECTOR}.innerText = String(${counterExpression}))}`;
  return `${base}\n${write}`;
}
