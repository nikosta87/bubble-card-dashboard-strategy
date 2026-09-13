import { DEFAULT_MAX_ENTITIES_PER_AREA } from "../constants";
import type { HassArea,HassDevice,HassEntity,HomeAssistant,LovelaceCard,StrategyConfig } from "../types";
import { bubblePopup,bubbleSeparator,buildFooter } from "../cards/common";
import { mediaPlayerToCard } from "../cards/media-player";
import { entityToCard,getEntityPresentation,groupRoomEntities,type EntityPresentation } from "../cards/entity-cards";
import { buildTopNavigation } from "../cards/navigation";
import { buildSmartRoomCards } from "../cards/room-cards";
import { createTranslator,type Translator } from "../i18n";
import { findFirstStateEntity,findLastUsedMediaPlayer,findStateEntities,getAreaEntities,getRoomHash } from "../utils/entities";
import { buildSummaryNavigation,buildSummaryPopups,getActiveSummaries } from "./summaries";

export function buildHomeView(areas:HassArea[],entities:HassEntity[],devices:HassDevice[],hass:HomeAssistant,options:StrategyConfig) {
  const t=createTranslator(hass); const activeSummaries=getActiveSummaries(areas,entities,devices,hass,options);
  return {type:"sections",max_columns:2,sections:[{type:"grid",cards:[
    buildTopNavigation(hass,options),...buildAdaptiveHomeSurface(hass,options),
    ...(activeSummaries.length?[buildSummaryNavigation(activeSummaries,t)]:[]),
    bubbleSeparator(t("rooms"),"mdi:floor-plan"),
    {type:"grid",square:false,columns:2,cards:buildSmartRoomCards(areas,entities,devices,hass,options)},
    ...areas.map(area=>buildRoomPopup(area,entities,devices,hass,options,t)),
    ...buildSummaryPopups(activeSummaries,hass,options,t),buildFooter(areas,t("rooms")),
  ]}]};
}

/** Home is attention based: one hero first, then only exceptional active context. */
function buildAdaptiveHomeSurface(hass:HomeAssistant,options:StrategyConfig):LovelaceCard[] {
  const weather=findFirstStateEntity(hass,["weather"]);
  const mediaCandidate=findLastUsedMediaPlayer(hass);
  const media=mediaCandidate&&["playing","paused"].includes(hass.states[mediaCandidate]?.state)?mediaCandidate:undefined;
  const vacuum=findStateEntities(hass,["vacuum"]).find(id=>{const s=hass.states[id]?.state;return s&&!["docked","idle","off","unavailable","unknown"].includes(s);});
  const mode=options.home_hero_mode??"adaptive"; const contextual=options.contextual_home_cards??true;
  const cards:LovelaceCard[]=[];

  if(mode==="media"&&media) cards.push(mediaPlayerToCard(media,options));
  else if(mode==="weather"&&weather) cards.push(weatherCard(weather));
  else if(mode==="adaptive") {
    if(media) cards.push(mediaPlayerToCard(media,options));
    else if(vacuum) cards.push(vacuumCard(vacuum));
    else if(weather) cards.push(weatherCard(weather));
  }

  if(!contextual) {
    if(weather&&!(mode==="weather"||(!media&&!vacuum&&mode==="adaptive"))) cards.push(weatherCard(weather));
    if(media&&!(mode==="media"||(mode==="adaptive"))) cards.push(mediaPlayerToCard(media,options));
  } else if(vacuum && !(mode==="adaptive"&&!media)) cards.push(vacuumCard(vacuum));
  return cards;
}

function weatherCard(entity:string):LovelaceCard{return {type:"weather-forecast",entity,forecast_type:"daily"};}
function vacuumCard(entity:string):LovelaceCard{return {type:"custom:bubble-card",card_type:"button",button_type:"state",entity,show_state:true,card_layout:"large",rows:2,button_action:{tap_action:{action:"more-info"}},sub_button:{main:[],bottom:[{buttons_layout:"inline",justify_content:"fill",group:[
  {entity,icon:"mdi:play",show_background:false,fill_width:true,tap_action:{action:"perform-action",perform_action:"vacuum.start",target:{entity_id:entity}}},
  {entity,icon:"mdi:pause",show_background:false,fill_width:true,tap_action:{action:"perform-action",perform_action:"vacuum.pause",target:{entity_id:entity}}},
  {entity,icon:"mdi:home-map-marker",show_background:false,fill_width:true,tap_action:{action:"perform-action",perform_action:"vacuum.return_to_base",target:{entity_id:entity}}},
]}]}};}

function buildRoomPopup(area:HassArea,entities:HassEntity[],devices:HassDevice[],hass:HomeAssistant,options:StrategyConfig,t:Translator):LovelaceCard {
  const areaEntities=getAreaEntities(area.area_id,entities,devices,hass,options); const max=options.max_entities_per_area??DEFAULT_MAX_ENTITIES_PER_AREA; let remaining=max;
  const groups=groupRoomEntities(areaEntities).map(group=>{const visible=group.entities.slice(0,remaining);remaining-=visible.length;return {...group,entities:visible};}); const cards:LovelaceCard[]=[];
  groups.forEach(group=>{if(!group.entities.length)return;cards.push(bubbleSeparator(t(group.titleKey),group.icon));cards.push(...buildResponsiveEntityGrids(group.entities,options,hass));});
  if(!cards.length)cards.push({type:"markdown",content:t("noEntities")});
  return bubblePopup({hash:getRoomHash(area),name:area.name,icon:area.icon||"mdi:home-outline",cards});
}

function buildResponsiveEntityGrids(entities:HassEntity[],options:StrategyConfig,hass:HomeAssistant):LovelaceCard[]{
  const runs:Array<{presentation:EntityPresentation;cards:LovelaceCard[]}>=[];
  entities.forEach(entity=>{const presentation=getEntityPresentation(entity,options,hass);const card=entityToCard(entity,options,hass);const current=runs[runs.length-1];if(current?.presentation===presentation)current.cards.push(card);else runs.push({presentation,cards:[card]});});
  return runs.map(run=>({type:"grid",square:false,columns:run.presentation==="wide"?1:2,cards:run.cards}));
}
