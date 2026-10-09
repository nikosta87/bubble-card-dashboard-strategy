import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource, makeHass } from './helpers.mjs';

const { entityBelongsToArea, getAreaEntities, getActiveAreas, orderAreas } =
  await loadSource('src/utils/entities.ts');
const { buildAreaView } = await loadSource('src/views/area-view.ts');
const registry = await loadSource('src/registry.ts');

const area = { area_id: 'living', name: 'Living Room' };
const devices = [{ id: 'lamp', area_id: 'living' }];

test('entity area overrides device area; disabled devices are excluded', () => {
  assert.equal(entityBelongsToArea({ entity_id: 'light.a', device_id: 'lamp' }, 'living', devices), true);
  assert.equal(entityBelongsToArea({ entity_id: 'light.a', device_id: 'lamp', area_id: 'office' }, 'living', devices), false);
  assert.equal(entityBelongsToArea({ entity_id: 'light.a', device_id: 'lamp' }, 'living', [{ ...devices[0], disabled_by: 'user' }]), false);
});

test('discovery excludes hidden, disabled, absent and explicitly ignored entities', () => {
  const entities = [
    { entity_id: 'light.visible', area_id: 'living' },
    { entity_id: 'light.hidden', area_id: 'living', hidden_by: 'user' },
    { entity_id: 'light.disabled', area_id: 'living', disabled_by: 'user' },
    { entity_id: 'light.missing', area_id: 'living' },
    { entity_id: 'light.ignored', area_id: 'living' },
    { entity_id: 'switch.ignored_domain', area_id: 'living' },
    { entity_id: 'light.other', area_id: 'office' },
  ];
  const hass = makeHass(Object.fromEntries(entities.filter(e => e.entity_id !== 'light.missing').map(e => [e.entity_id, {}])));
  assert.deepEqual(getAreaEntities('living', entities, devices, hass,
    { ignored_entities: ['light.ignored'], ignored_domains: ['switch'] }).map(e => e.entity_id), ['light.visible']);
});

test('discovery sorts by friendly name', () => {
  const entities = ['light.a', 'light.z'].map(entity_id => ({ entity_id, area_id: 'living' }));
  const hass = makeHass({ 'light.a': { friendly_name: 'Zebra' }, 'light.z': { friendly_name: 'Apple' } });
  assert.deepEqual(getAreaEntities('living', entities, [], hass, {}).map(e => e.entity_id), ['light.z', 'light.a']);
});

test('active rooms include device assignments and respect visibility and custom ordering', () => {
  const areas = [area, { area_id: 'office', name: 'Office' }, { area_id: 'empty', name: 'Empty' }];
  const active = getActiveAreas(areas, [{ entity_id: 'light.a', device_id: 'lamp' }, { entity_id: 'light.b', area_id: 'office' }], devices);
  assert.deepEqual(active.map(a => a.area_id), ['living', 'office']);
  assert.deepEqual(orderAreas(active, { hidden_areas: ['office'] }).map(a => a.area_id), ['living']);
  assert.deepEqual(orderAreas(active, { room_order: 'custom', custom_room_order: ['office'] }).map(a => a.area_id), ['office', 'living']);
  assert.deepEqual(areas.map(a => a.area_id), ['living', 'office', 'empty']);
});

test('area view limits generated controls and preserves entity IDs', () => {
  const entities = ['light.a', 'light.b'].map(entity_id => ({ entity_id, area_id: 'living' }));
  const view = buildAreaView(area, entities, [], makeHass({ 'light.a': {}, 'light.b': {} }), { max_entities_per_area: 1 });
  assert.equal(view.type, 'sections');
  const grid = view.sections[0].cards[1];
  assert.equal(grid.cards.length, 1);
  assert.equal(grid.cards[0].entity, 'light.a');
});

test('empty area view shows a useful fallback', () => {
  const view = buildAreaView(area, [], [], makeHass(), {});
  assert.equal(view.sections[0].cards[1].type, 'markdown');
  assert.match(view.sections[0].cards[1].content, /No visible entities/);
});

test('registry requests are shared and invalidation refetches all registries', async () => {
  registry.invalidateRegistries();
  const calls = [];
  const hass = { ...makeHass(), callWS: async message => { calls.push(message.type); return []; } };
  await Promise.all([registry.getRegistries(hass), registry.getRegistries(hass)]);
  assert.equal(calls.length, 3);
  registry.invalidateRegistries();
  await registry.getRegistries(hass);
  assert.equal(calls.length, 6);
});

test('failed registry requests do not poison the cache', async () => {
  registry.invalidateRegistries();
  const hass = { ...makeHass(), callWS: async () => { throw new Error('Disconnected'); } };
  await assert.rejects(registry.getRegistries(hass), /Disconnected/);
  hass.callWS = async () => [];
  assert.deepEqual(await registry.getRegistries(hass), { areas: [], devices: [], entities: [] });
});
