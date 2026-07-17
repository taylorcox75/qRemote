# qRemote

Native iOS app for qBittorrent • **[GitHub](https://github.com/taylorcox75/qRemote/)**

**iOS:** [Download on the App Store](https://apps.apple.com/app/qremote-for-qbittorrent/id6756276747) · [TestFlight Beta](https://testflight.apple.com/join/ZHp9Uq4h)

## Screenshots

<p align="center">
  <img src="screenshots/torrent-list.png" width="260">
  <img src="screenshots/torrent-detail.png" width="260">
  <img src="screenshots/transfer.png" width="260">
</p>

<p align="center">
  <img src="screenshots/search.png" width="260">
  <img src="screenshots/server-settings.png" width="260">
</p>

## What It Does

- Manage torrents: pause, resume, delete, recheck, reannounce, force start
- Built-in search across your qBittorrent search plugins, with indexer and category filters
- Monitor transfers with real-time updates and a live speed graph
- Speed limits — global, per-torrent, and alternative speed toggle
- Manage trackers, files, priorities, categories, and tags
- Add torrents via magnet links or .torrent files (qRemote registers as an "Open With" handler)
- Multiple servers with secure credential storage, HTTPS, and reverse-proxy Basic Auth support
- Fully customizable theme colors, dark/light mode
- Available in 6 languages: English, Spanish, Chinese, French, German, Russian

## Requirements

- qBittorrent 4.1+ with WebUI enabled
- iOS 16.4+
- Node.js 18+ (for development)

## Getting Started

```bash
git clone https://github.com/taylorcox75/qRemote.git
cd qRemote
npm install
npm start
```

Scan the QR code with Expo Go or press `i` for iOS simulator.

### Building

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile production
```

## Setup

1. Go to Settings → tap **+**
2. Add your qBittorrent server (IP/hostname, port, credentials)
3. Enable HTTPS if needed
4. Connect and you're good to go

## Built With

React Native (Expo), TypeScript, Expo Router

## Contributing

PRs welcome. Issues too.

## License

MIT
