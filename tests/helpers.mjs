import { build } from 'esbuild';

// Bundle the actual TypeScript modules using the same compiler as production.
// Data URLs keep tests independent of generated files and additional dependencies.
export async function loadSource(entry) {
  const result = await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}

export function makeHass(states = {}) {
  return {
    config: { location_name: 'Test Home' },
    states: Object.fromEntries(Object.entries(states).map(([entity_id, attributes]) =>
      [entity_id, { entity_id, state: 'off', attributes }])),
    callWS: async () => [],
  };
}
