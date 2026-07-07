import { EDITOR_ELEMENT, STRATEGY_TYPE } from "./constants";
import { getRegistries } from "./registry";
import type {
  HassArea,
  HassDevice,
  HassEntity,
  HomeAssistant,
  StrategyConfig,
} from "./types";
import { entityBelongsToArea, getSonosMediaPlayers } from "./utils/entities";
import { buildAreaView } from "./views/area-view";
import { buildHomeView } from "./views/home-view";

export class BubbleDashboardStrategy extends HTMLElement {
  static getCreateSuggestions(_hass: HomeAssistant) {
    return {
      title: "Bubble Card Dashboard",
      icon: "mdi:home-variant",
    };
  }

  static async generate(config: StrategyConfig, hass: HomeAssistant) {
    const { areas, devices, entities } = await getRegistries(hass);

    const activeAreas = areas
      .filter((area) => entities.some((entity) => entityBelongsToArea(entity, area.area_id, devices)))
      .sort((left, right) => left.name.localeCompare(right.name));

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
            sonosEntities: getSonosMediaPlayers(entities, config),
          },
        },
      ],
    };
  }

  static async getConfigElement() {
    await customElements.whenDefined(EDITOR_ELEMENT);
    return document.createElement(EDITOR_ELEMENT);
  }
}

export class BubbleViewStrategy extends HTMLElement {
  static async generate(config: Record<string, unknown>, hass: HomeAssistant) {
    const options = (config.options || {}) as StrategyConfig;

    if (config.view === "home") {
      return buildHomeView(
        config.areas as HassArea[],
        config.entities as HassEntity[],
        config.devices as HassDevice[],
        hass,
        options,
        config.sonosEntities as string[] | undefined,
      );
    }

    return buildAreaView(
      config.area as HassArea,
      config.entities as HassEntity[],
      config.devices as HassDevice[],
      hass,
      options,
    );
  }
}
