# Changelog

All notable changes to Bubble Card Dashboard Strategy are documented here.

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
