# qRemote

Native iOS app for qBittorrent • **[GitHub](https://github.com/taylorcox75/qRemote/)**

**iOS:** [Download on the App Store](https://apps.apple.com/app/qremote-for-qbittorrent/id6756276747) · [TestFlight Beta](https://testflight.apple.com/join/ZHp9Uq4h)

## Screenshots

### Torrent Card

Your torrents at a glance — status, speed, progress, and ETA on every card, with one-tap pause/resume. Filter by state, search, and sort however you want.

<p align="center">
  <img src="https://i.imgur.com/8wMET7H.png" width="250">
</p>

### Detailed Torrent Card

Expand any card inline for the full picture: seeds, peers, ratio, availability, popularity, upload speed, category, and date added — without leaving the list.

<p align="center">
  <img src="https://i.imgur.com/sYJdadK.png" width="250">
</p>

### Torrent View

Everything about a single torrent in one place. Pause, recheck, or delete up top; manage ratio limits, seeding time, save path, category, tags, trackers, files, and peers below.

<p align="center">
  <img src="https://i.imgur.com/lnbMj7E.png" width="250">
</p>

### Transfer Management

Live speed graph with session and all-time stats. Set global speed limits, toggle alternative speeds, and resume, pause, or force-start everything at once. Connection health — DHT nodes, peers, and free disk space — is right there too.

<p align="center">
  <img src="https://i.imgur.com/L68N3Bw.png" width="250">
  <img src="https://i.imgur.com/I4xmXaX.png" width="250">
</p>

### Search Plugins

Search your qBittorrent search plugins directly from the app. Filter by plugin, category, or indexer (works great with Prowlarr/Jackett), sort the results, and add a torrent in one tap.

<p align="center">
  <img src="https://i.imgur.com/Nh35yPS.png" width="250">
</p>

### Torrent Settings

Tune how torrents behave: default sort and filter for the list, pause on add, default save path, auto-categorize by tracker, first/last piece priority, and full category and tag management.

<p align="center">
  <img src="https://i.imgur.com/eMw77bm.png" width="250">
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
