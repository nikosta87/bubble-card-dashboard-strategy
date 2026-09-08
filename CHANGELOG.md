# Changelog

All notable changes to Bubble Card Dashboard Strategy are documented here.

## [0.24.0] - 2026-09-08

### Added

- Capability-aware room popup layout that chooses compact two-column or wide one-column presentation per entity instead of forcing one grid size on an entire domain group
- Full-width mobile Bubble Card popups for more usable control space on phones

### Changed

- Rich light cards with brightness, colour temperature, or colour capabilities now use the full popup width
- Brightness remains the primary light slider while colour temperature and colour are compact secondary controls, preventing three sliders from being squeezed into one row
- Climate, media, covers, alarms, locks, selects, vacuums, and other interaction-heavy controls use wide presentation; simple switches, scenes, scripts, and buttons remain compact
- Home room cards show at most two secondary status chips so temperature, contact, presence, and light states no longer overflow half-width tiles
- Home overview cards no longer share a forced two-column grid; active media and vacuum controls receive the full available width
- Home media appears only while playing or paused, and vacuum controls appear only while the vacuum is active

### Fixed

- Prevented room light controls and long entity names from being compressed into unusable half-width cards on mobile
- Prevented Home room status sub-buttons from being clipped at narrow viewport widths

## [0.23.0] - 2026-09-07

### Added

- Native Home Assistant Community dashboards registration for Home Assistant 2026.5 and newer via `window.customStrategies`
- Friendly dashboard name, description, and documentation URL for Home Assistant's dashboard picker
- Native dashboard creation flow without requiring users to paste strategy YAML manually

### Changed

- The compiled HACS bundle is synchronized automatically during the build workflow
- Dashboard UX upgraded with capability-aware controls, dynamic light surfaces, improved room/media/vacuum experiences, and hardened build/release workflows

### Compatibility

- Existing dashboards using `strategy.type: custom:bubble-card-dashboard` continue to work unchanged
- The strategy custom element remains `ll-strategy-dashboard-bubble-card-dashboard`

## [0.22.1] - 2026-07-15

### Changed

- Room-card status sub-buttons now use Bubble Card's dedicated bottom row so room names remain visible
- Climate and media player cards now use the full room pop-up width
- Room Lights sections now contain only `light.*` entities; switches and input booleans are shown under Devices
- Room entity limits now prioritize Lights, Climate, and Media so large device lists cannot hide primary controls
- Home summary tiles are replaced by one compact Bubble Card sub-button row
- Media players now use only the Bubble Card implementation while the dashboard foundation is being built

### Removed

- Removed the untested camera navigation, settings, discovery, and generated pop-up

### Fixed

- Restored usable climate mode and Bubble Card volume controls in narrow room pop-ups

## [0.22.0] - 2026-07-15

### Added

- Smart room cards with automatically detected temperature, presence, contact, and light sub-buttons
- Bubble Card slider controls for lights, fans, number entities, and input numbers
- HVAC mode select sub-buttons for climate entities
- Volume slider sub-buttons for Bubble Card media players
- Generated camera pop-up with automatic camera discovery
- Optional live camera previews
- Bubble Card 3.2 adaptive dialog and performance settings for generated pop-ups
- Graphical editor controls for the new camera and advanced-control options

### Changed

- The camera navigation button is only shown when at least one usable camera exists
- Generated room controls now support `input_select`, `number`, and `input_number` entities
- New Home Assistant actions use `perform-action`
- Bubble Card 3.2.0 is now the minimum supported Bubble Card version

### Fixed

- Fixed the Cameras navigation button opening a hash without a corresponding pop-up

[0.22.0]: https://github.com/nikosta87/bubble-card-dashboard-strategy/releases/tag/v0.22.0
[0.22.1]: https://github.com/nikosta87/bubble-card-dashboard-strategy/releases/tag/v0.22.1
[0.23.0]: https://github.com/nikosta87/bubble-card-dashboard-strategy/releases/tag/v0.23.0
[0.24.0]: https://github.com/nikosta87/bubble-card-dashboard-strategy/releases/tag/v0.24.0
