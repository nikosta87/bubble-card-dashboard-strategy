# Bubble Card Dashboard Strategy

A Home Assistant dashboard strategy that automatically generates an area-based dashboard using [Bubble Card](https://github.com/Clooos/Bubble-Card).

This project is built for people who want a clean Bubble Card dashboard without manually creating every room view, button, and navigation element. It reads your Home Assistant areas, devices, and entities, then creates a generated Lovelace dashboard from that structure.

## Features

- Automatic dashboard generation from Home Assistant areas
- One app-like Home view
- Top navigation bar using Bubble Card sub-buttons
- Smart room cards with automatically selected temperature, presence, contact, and light status controls
- Room overview pop-up
- One generated pop-up per area
- Bubble Card sliders and select sub-buttons for compatible entities
- Bubble Card controls for lights, switches, covers, climate entities, media players, selects, scripts, scenes, and more
- Optional entity and domain filtering
- HACS custom repository support

## Requirements

- Home Assistant with dashboard strategy support
- [Bubble Card](https://github.com/Clooos/Bubble-Card) 3.2.0 or newer installed
- [auto-entities](https://github.com/thomasloven/lovelace-auto-entities) installed for the status-grouped summaries (Lights, Security, Batteries)
- [card-mod](https://github.com/thomasloven/lovelace-card-mod) installed if you want all Home overview cards to use the same fixed height
- Areas configured in Home Assistant
- Devices and entities assigned to areas

Bubble Card is required. This strategy generates `custom:bubble-card` cards, but it does not install Bubble Card for you.

## Installation

### HACS Custom Repository

1. Open Home Assistant.
2. Go to **HACS**.
3. Open the three-dot menu and select **Custom repositories**.
4. Add this repository:

   ```text
   https://github.com/nikosta87/bubble-card-dashboard-strategy
   ```

5. Select **Dashboard** as the repository category.
6. Download **Bubble Card Dashboard Strategy**.
7. Reload Home Assistant or refresh your browser.

After installation, HACS should add the dashboard resource automatically. If you need to add it manually, use:

```text
/hacsfiles/bubble-card-dashboard-strategy/bubble-card-dashboard-strategy.js
```

Resource type:

```text
JavaScript Module
```

### Manual Installation

1. Download `bubble-card-dashboard-strategy.js` from the `dist/` folder.
2. Copy it to your Home Assistant `www` folder, for example:

   ```text
   /config/www/bubble-card-dashboard-strategy/bubble-card-dashboard-strategy.js
   ```

3. Add the resource in Home Assistant:

   ```yaml
   lovelace:
     mode: storage
     resources:
       - url: /local/bubble-card-dashboard-strategy/bubble-card-dashboard-strategy.js
         type: module
   ```

4. Restart Home Assistant or reload the frontend.

## Create A Dashboard

1. Go to **Settings** → **Dashboards**.
2. Create a new dashboard.
3. Open the dashboard.
4. Enter edit mode.
5. Open the three-dot menu and select **Raw configuration editor**.
6. Add:

   ```yaml
   strategy:
     type: custom:bubble-card-dashboard
   ```

7. Save the dashboard.

## Troubleshooting

### Timeout waiting for strategy element

If Home Assistant shows this error:

```text
Timeout waiting for strategy element ll-strategy-dashboard-bubble-card-dashboard to be registered
```

the JavaScript resource was not loaded correctly.

Check **Settings** → **Dashboards** → three-dot menu → **Resources** and make sure this resource exists:

```text
/hacsfiles/bubble-card-dashboard-strategy/bubble-card-dashboard-strategy.js
```

The resource type must be:

```text
JavaScript Module
```

If you installed manually, use your `/local/...` path instead.

Also try:

- hard-refreshing the browser
- clearing the browser cache
- removing duplicate or old resources for this strategy
- downloading the repository again in HACS
- restarting Home Assistant

## Configuration

Basic example:

```yaml
strategy:
  type: custom:bubble-card-dashboard
```

Example with options:

```yaml
strategy:
  type: custom:bubble-card-dashboard
  title: My Home
  profile_image: /local/profile.jpg
  enable_advanced_controls: true
  max_entities_per_area: 24
  ignored_domains:
    - sensor
  ignored_entities:
    - light.unused_light
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | string | Home Assistant location name | Dashboard title |
| `profile_image` | string | none | Optional image URL for the round avatar in the top navigation |
| `enable_advanced_controls` | boolean | `true` | Enables compatible Bubble sliders and select sub-buttons |
| `max_entities_per_area` | number | `24` | Maximum number of generated entity cards per area |
| `ignored_domains` | string[] | `[]` | Domains to exclude from generated room views |
| `ignored_entities` | string[] | `[]` | Specific entities to exclude |

### Graphical Editor

The dashboard includes a Home Assistant strategy editor, similar to the editor used by Simon42 Dashboard Strategy.

Open the dashboard, click the edit pencil, then open the dashboard edit dialog. The editor lets you configure:

- dashboard title
- profile image URL
- advanced Bubble controls
- maximum generated entities per room

### Smart Room Cards

Each visible Home Assistant area is rendered as a smart Bubble Card on the Home screen. Tapping the card opens its room pop-up. When matching entities are available, the card automatically adds live sub-buttons for:

- temperature
- motion, occupancy, or presence
- door or window contacts
- a room light

Detection uses Home Assistant area assignments and device classes, so entities do not need special names. Room visibility and ordering continue to use the existing room settings in the graphical editor.

Room pop-ups classify controls by their Home Assistant domain. The Lights section contains only `light.*` entities. `switch.*` and `input_boolean.*` entities appear under Devices, matching the separation used by Simon42 Dashboard Strategy. When a room reaches its configured entity limit, Lights, Climate, and Media are prioritized before general devices.

### Advanced Bubble Controls

With `enable_advanced_controls` enabled, compatible entities use richer Bubble Card controls:

- sliders for lights, fans, `number`, and `input_number` entities
- an HVAC mode select sub-button for climate entities
- a volume slider sub-button for Bubble Card media players
- Bubble Card select cards for `select` and `input_select` entities

Disable the option to use simpler switch-style controls.

### Media Player Cards

The Home overview media card automatically chooses the best media player to show. It prefers currently playing players, then paused players, then the most recently updated media player with media metadata or artwork.

Media players are generated exclusively as Bubble Card media-player cards while the dashboard foundation is being built. With advanced controls enabled, the card uses a dedicated bottom row for an always-visible volume slider.

### Summary Navigation

The Home screen displays enabled summaries as one compact Bubble Card `sub-buttons` row. Each chip opens the corresponding generated pop-up for Lights, Security, Climate, or Batteries. Summary visibility remains configurable in the dashboard editor.

## How It Works

The strategy uses the Home Assistant area, device, and entity registries to build the dashboard. The overview page links to generated room views. Each room view contains Bubble Card controls for supported entities assigned to that area.

Hidden and disabled entities are ignored automatically.

The generated dashboard uses Bubble Card pop-ups:

- `#rooms` opens the room overview
- `#room-{room-name}` opens a generated room detail pop-up
- generated pop-ups use Bubble Card 3.2 adaptive dialogs and performance mode

## Development

Install dependencies:

```bash
npm install
```

Build the strategy:

```bash
npm run build
```

The compiled file is written to:

```text
dist/bubble-card-dashboard-strategy.js
```

## Roadmap

Development is organized into testable release packages. See [ROADMAP.md](ROADMAP.md) for the complete plan and current status, and [CHANGELOG.md](CHANGELOG.md) for release notes.

## Credits

This project is inspired by the great work of the Home Assistant community and the dashboard strategy approach used by projects like [Simon42 Dashboard Strategy](https://github.com/TheRealSimon42/simon42-dashboard-strategy).

Bubble Card is created and maintained by [Clooos](https://github.com/Clooos/Bubble-Card).
