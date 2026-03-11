# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2] - 2026-03-11

### Fixed
- Torrents simultaneously uploading and downloading now display blue-grey color instead of purple
- Upload+download color state now uses the correct `stateUploadAndDownload` theme color (#6B7B8C)

## [2.1.1] - 2026-03-01

### Added
- Color theming support with customizable torrent state colors
- Save default path functionality

### Fixed
- File manager improvements and bug fixes

## [2.0.1] - 2026-02-25

### Fixed
- Merge incremental maindata server_state updates

### Changed
- Cleaned up versioning system

## [2.0.0] - 2026-02-18

### Added
- Language translation support
- Sorting by ratio
- Info button for torrent seed percent/leach
- Export logs with connectivity logging
- Debug panel export button

### Changed
- Applied Apple developer NSAllowsArbitraryLoads flag for better connectivity

## [1.1.3] - 2026-02-06

### Fixed
- Protocol prefix handling improvements
- Hostname handling issues

### Added
- Community links

## [1.1.0] - 2026-02-01

### Added
- Loading screen when launching and when restoring from background

### Fixed
- Popup improvements for Android
- Android localhost connection issue

## [1.0.5] - 2025-12-14

### Added
- Toast notification system (replaced Alert dialogs)
- Custom theme color support with theme settings screen
- Log storage and viewing capabilities

### Changed
- Enhanced UI components with improved accessibility and positioning
- Centralized version management from package.json
- Updated dependencies and TypeScript configuration

## [1.0.1] - 2025-12-13

### Changed
- Formatting improvements for add server screen
- Changes for foldable devices

## [1.0.0] - 2025-12-12

### Added
- Initial public beta release
- Material Design interface
- Dark/light mode support
- Tracker management on dedicated page
- Force reannounce moved to tracker page

### Changed
- Redesigned entire interface
- Better visual hierarchy across all screens
- New design system with reusable components

### Fixed
- Dates no longer show as 12/31/1969 when not available
- Sort menu text now readable in light mode
- Select checkbox moved to filter row for better layout

[2.1.2]: https://github.com/taylorcox75/qRemote/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/taylorcox75/qRemote/compare/v2.0.1...v2.1.1
[2.0.1]: https://github.com/taylorcox75/qRemote/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/taylorcox75/qRemote/compare/v1.1.3...v2.0.0
[1.1.3]: https://github.com/taylorcox75/qRemote/compare/v1.1.0...v1.1.3
[1.1.0]: https://github.com/taylorcox75/qRemote/compare/v1.0.5...v1.1.0
[1.0.5]: https://github.com/taylorcox75/qRemote/compare/v1.0.1...v1.0.5
[1.0.1]: https://github.com/taylorcox75/qRemote/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/taylorcox75/qRemote/releases/tag/v1.0.0
