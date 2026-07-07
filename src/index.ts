import {
  DASHBOARD_ELEMENT,
  EDITOR_ELEMENT,
  STRATEGY_TYPE,
  VERSION,
  VIEW_ELEMENT,
} from "./constants";
import { BubbleCardDashboardStrategyEditor } from "./editor";
import { BubbleDashboardStrategy, BubbleViewStrategy } from "./strategies";

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
    documentationURL: "https://github.com/nikosta87/bubble-card-dashboard-strategy",
  });
}

console.info(
  `%cBUBBLE-CARD-DASHBOARD-STRATEGY%c ${VERSION}`,
  "color: white; background: #1d8cf8; font-weight: 700; padding: 2px 4px; border-radius: 3px;",
  "color: #1d8cf8; font-weight: 700;",
);

declare global {
  interface Window {
    customStrategies?: Array<Record<string, unknown>>;
  }
}
