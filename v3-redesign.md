# qRemote v3 — Design Redesign Vision

> A Steve Jobs–level, Apollo-inspired redesign plan for the v3 launch.
> This document contrasts the current UI with what a world-class iOS app looks like,
> and proposes specific, actionable changes for every screen.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [What's Wrong Today (Honest Critique)](#2-whats-wrong-today)
3. [The v3 Design System](#3-the-v3-design-system)
4. [Screen-by-Screen Redesign](#4-screen-by-screen-redesign)
5. [Interaction & Motion Design](#5-interaction--motion-design)
6. [The "Wow Factor" Moments](#6-the-wow-factor-moments)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Design Philosophy

### What Makes Apollo, Things 3, Ivory, and Halide Feel Different

These apps don't just look good — they feel *inevitable*. Every pixel earns its place. The core principles:

**Show less, mean more.** Apollo shows one torrent's worth of information in the space qRemote uses for metadata labels. Things 3 has maybe 6 visible UI elements on any given screen. Halide has *one* button. The confidence to remove elements is the hardest design skill.

**Typography IS the interface.** Great iOS apps use font weight, size, and color to create hierarchy — not boxes, borders, badges, and colored backgrounds. A 28pt bold title next to 13pt secondary text creates visual structure without any chrome.

**Color is signal, not decoration.** Apollo uses exactly one accent color (a deep blue) and reserves other colors exclusively for semantic meaning. The rest of the UI is grayscale. When color appears, it *means* something.

**Motion creates understanding.** Every transition teaches the user where they are in the spatial model. Cards expand into detail views. Lists slide in from the direction they'll slide back to. Spring physics make everything feel physical.

**The platform is your friend.** Native iOS context menus, native share sheets, native haptics, SF Symbols, grouped inset lists. Fighting the platform creates uncanny valley. Embracing it creates trust.

---

## 2. What's Wrong Today

### The Honest Critique

I'm going to be blunt, because that's what gets us to great.

#### 2.1 The Rainbow Button Grid (Critical)

The torrent detail "Advanced" section is the single biggest design problem. **16 brightly colored buttons in a 2×8 grid** — Force Start (blue), Super Seed (orange), Sequential DL (blue), First/Last Priority (orange), ↑Priority (green), ↓Priority (red), Max Priority (green), Min Priority (red), DL Limit (gray), UL Limit (gray), Edit Trackers (purple), Set Category (gray), Add Tags (green), Remove Tags (pink), Set Location (gray), Rename (gray).

This looks like a Fisher-Price toy. Every button screams for attention equally. The user's eye has nowhere to rest. Apollo would *never* show 16 equally-weighted actions. Things 3 would *never* use 8 different button colors on one screen.

**The fix:** Most of these actions belong in a native iOS context menu or a grouped inset list with disclosure indicators. The user taps "Priority" once and gets a sub-menu. Not 4 separate colored buttons for up/down/max/min.

#### 2.2 Information Without Hierarchy

The compact torrent card stat row:
```
100.0% | 1.52 GB | ∞ | ↓ 0 B/s | ↑ 0 B/s | Ratio: 22.57
```

This is a pipe-delimited data dump. Every value has the same font size (10px), same weight, same color. The user's eye scans left-to-right reading every value because nothing says "this is what matters right now."

The expanded card stat grid is worse — 10 values in a 5×2 grid, all at 10–12px, all the same visual weight:
```
DL Speed:    UL Speed:    ETA:        Percent:    Downloaded:
2.2 KB/s     0 B/s        68h 32m     35.6%       273.98 MB

Size:        Seeds:       Peers:      UL Ratio:   Availability:
753.91 MB    358/1885     27/105      0.00        294.00
```

This is a spreadsheet, not a designed interface. Compare to how Apollo shows a Reddit post: the *title* dominates, the vote count is prominent, the metadata (author, time, subreddit) is small and secondary. Hierarchy.

**The fix:** Show 2–3 key metrics prominently (speed, progress, ETA). Everything else goes into the detail view.

#### 2.3 The State Badge Dominates the Card

The solid-color badges (green "Seeding", blue "Downloading", orange "Metadata", gray "Stopped") with white bold text on saturated backgrounds are visually heavier than the torrent name itself. The badge is the first thing the eye sees on every card. But the *name* is what matters — that's how the user identifies their content.

**The fix:** Use subtle tinted pills (like iOS notification badges) or just a colored dot + text label. The name should be the visual anchor.

#### 2.4 Mixed Design Languages

The app simultaneously uses:
- **Material Design FAB** (floating blue "+" button) — this is Google's pattern, not Apple's
- **Material Design section headers** ("CURRENT SPEED", "QUICK ACTIONS") — all-caps, small, gray
- **Material Design chip filters** (filled pill-shaped buttons in a horizontal scroll)
- **iOS-style search bar** (with magnifying glass icon)
- **iOS-style grouped cards** (rounded corners, surface background)
- **Custom popup menu** (not native iOS context menus)
- **Android-style colored buttons** (full-width, multiple colors)

This creates design uncanny valley. The app doesn't feel like it belongs to any platform. Apollo feels like it was *born* on iOS. qRemote feels like it's visiting.

#### 2.5 The Transfer Screen Is a Dashboard, Not a Story

The Transfer screen is organized like a monitoring dashboard:
- CURRENT SPEED (graph + numbers)
- QUICK ACTIONS (6 colored squares)
- STATISTICS (data cards)
- SPEED LIMITS (chip grids)
- CONNECTION (status info)

Each section is a self-contained widget. There's no narrative flow — no sense of "here's what's happening now, and here's what you can do about it." The 6 quick-action squares (Resume All, Pause All, Alt Speed, Force Start All, Pause All DL, Pause All UL) are particularly problematic: who actually uses "Pause All DL" separately from "Pause All"?

#### 2.6 Settings Is Flat and Endless

The Settings screen is a single long scroll with 10+ sections. No visual grouping beyond the all-caps labels. The red "Disconnect" button, green toggles, and blue icons all compete. There's no sense of what's important vs. what's advanced.

#### 2.7 No Personality

The onboarding has nice mockup illustrations, but once you're in the app, there is zero personality. Empty states are generic icons + text. There are no delightful moments. No easter eggs. No moments where you think "oh, that's nice."

The best iOS apps have *character*. Apollo had the cute astronaut. Things 3 has the satisfying check-off animation. Halide has the film-camera aesthetic. qRemote is currently a utility. It works, but it doesn't *spark*.

---

## 3. The v3 Design System

### 3.1 Color System

**One accent color. That's it.**

```
Accent:        #0A84FF (iOS system blue)
Accent tint:   rgba(10, 132, 255, 0.12)  — for backgrounds, selection
Accent dark:   #0070E0                    — for pressed states
```

All other colors are **semantic only**:
```
Download:      #34C759 (system green)   — only when actively downloading
Upload:        #5AC8FA (system cyan)    — only when actively uploading
Error:         #FF3B30 (system red)     — only for errors and destructive actions
Warning:       #FF9500 (system orange)  — only for warnings
Paused:        textTertiary             — just dim, no special color
```

**Kill the per-state color rainbow.** Currently there are 11 state colors (stateDownloading, stateSeeding, stateUploadAndDownload, stateUploadOnly, stateError, stateStalled, statePaused, stateChecking, stateMetadata, stateQueued, stateOther). Reduce to 4: active-download (green), active-upload (cyan), error/stalled (red/orange), inactive (gray). The left border color stripe on cards is a nice idea but with 11 colors it's noise. With 4 it's signal.

**Surface palette (dark mode):**
```
background:    #000000     — true black for OLED (not rgb(15,15,15))
surface1:      #1C1C1E     — cards, grouped list background
surface2:      #2C2C2E     — elevated cards, modals
surface3:      #3A3A3C     — tertiary surfaces
separator:     #38383A     — list separators (1px hairline)
```

**Surface palette (light mode):**
```
background:    #F2F2F7     — system grouped background
surface1:      #FFFFFF     — cards
surface2:      #F9F9F9     — elevated
separator:     #C6C6C8     — system separator
```

**Text palette:**
```
primary:       label color (adapts to light/dark)
secondary:     secondaryLabel
tertiary:      tertiaryLabel
quaternary:    quaternaryLabel
```

### 3.2 Typography

**Use SF Pro with intentional hierarchy.**

```
largeTitle:    34pt Bold      — screen titles (Torrents, Transfer, Settings)
title1:        28pt Bold      — empty state titles
title2:        22pt Bold      — section headers
title3:        20pt Semibold  — subsection headers
headline:      17pt Semibold  — card titles, torrent names
body:          17pt Regular   — primary content
callout:       16pt Regular   — secondary content
subhead:       15pt Regular   — list row detail
footnote:      13pt Regular   — metadata, timestamps
caption1:      12pt Regular   — small labels
caption2:      11pt Regular   — badges, tiny labels
```

Key change: **torrent names at 17pt Semibold** (currently 15pt 600). This makes the name the undeniable visual anchor of each card.

### 3.3 Spacing & Corners

```
Spacing:
  xs:   4      — icon gaps
  sm:   8      — tight internal padding
  md:   12     — standard gaps
  lg:   16     — section padding, card padding
  xl:   20     — inter-section spacing
  xxl:  32     — major section breaks

Corners:
  small:  8    — chips, small badges
  medium: 12   — cards, buttons, inputs
  large:  16   — modals, sheets, grouped lists
  full:   9999 — pills, circular elements

Shadows:       REMOVE MOST OF THEM
```

**On shadows:** iOS 17+ design language has moved away from card shadows. Apple's own apps (Settings, Health, Fitness) use flat cards on grouped backgrounds with zero shadow. The depth comes from background color contrast alone. The current `shadows.card` with `shadowOpacity: 0.06` is fine for light mode, but in dark mode, shadows are invisible anyway. **Remove all dark mode shadows and simplify light mode to a single, barely-visible elevation.**

### 3.4 Icons

**Replace Ionicons with SF Symbols (via `expo-symbols` or a curated icon set).**

Ionicons are generic and feel cross-platform. SF Symbols feel *native*. They have weight variants that match the text weight next to them, they optionally animate, and they have built-in accessibility.

If SF Symbols aren't available via Expo, curate a set of ~40 icons that match SF Symbols' line weight and optical sizing. Consider using `@nandorojo/iconic` or similar.

### 3.5 The "Grouped Inset" Pattern

Apple's primary layout pattern for settings, details, and forms is the **grouped inset list**: rounded-corner sections with hairline separators, sitting on a grouped background. Currently the app uses something similar but inconsistently — some screens use it, others use cards, others use flat layouts.

**v3 rule:** Every non-list screen (settings, detail, transfer) uses grouped inset sections exclusively. The torrent list is the only screen that uses cards.

---

## 4. Screen-by-Screen Redesign

### 4.1 Torrents List (Main Screen)

**Current:** Search bar → horizontal chip filters → card list with left-border color stripe, stat grid, play/pause button, three-dot menu. Material Design FAB at bottom-right.

**v3 Vision:**

**Navigation bar:** Large title "Torrents" in the native iOS large-title style (collapses on scroll). Right bar button: "+" icon (replaces the FAB). Left bar button: filter/sort icon or edit button.

**Search:** Native iOS search bar that appears when pulling down (like Mail, Messages). Not always visible — it appears on scroll-down or tap. This reclaims vertical space.

**Filters:** Replace chip scroll with a **native iOS scope bar** below the search field (like Mail's Inbox/VIPs/Flagged). Show 4 max: All, Active, Done, Paused. "Stuck" and per-state filters go into a dropdown accessed via the filter icon.

**Torrent card redesign:**

```
┌─────────────────────────────────────────────┐
│  Ubuntu 24.04 Desktop.iso                   │
│  ● Downloading · 8.4 MB/s ↓                │
│  ████████████████████░░░░░░░░  72% · 23m    │
│  3.2 / 4.4 GB                               │
└─────────────────────────────────────────────┘
```

- **Line 1:** Torrent name in 17pt Semibold. This is the visual anchor.
- **Line 2:** Small colored dot (4px) + state text in secondary color + speed (only shown if non-zero). No badge. No colored background. Just a dot and text.
- **Line 3:** Progress bar (thin, 3px, no border radius — like Apple Music download progress) + percentage + ETA. The progress bar uses the accent color (blue) for downloads, green for seeding, gray for paused.
- **Line 4:** Size info in tertiary text.

**What's removed from the card:**
- The 10-value stat grid → moved to detail screen
- The play/pause circle button → replaced by swipe action
- The three-dot menu button → replaced by native iOS context menu (long press)
- The left border color stripe → replaced by the dot
- The state badge → replaced by the dot + text

**Swipe actions (like Mail):**
- Swipe left (short): Pause/Resume
- Swipe left (long): Delete
- Swipe right: Quick options (force start, priority)

**Context menu (long press):** Uses native iOS `ContextMenu` API (available via `react-native-ios-context-menu` or similar). Shows: Resume/Pause, Force Start, Set Priority ▸ (submenu), Copy Magnet Link, Verify Data, Reannounce, Delete.

**The "+" action:** Tapping "+" in the nav bar presents a **bottom sheet** (not a centered modal) with the add-torrent form. The sheet is draggable and uses the native sheet presentation style.

**Empty state:** Instead of a generic icon, show a stylized illustration or a clean, branded graphic. "No torrents yet" with a single "Add Torrent" button. Minimal, confident, no subtitle needed.

### 4.2 Torrent Detail

**Current:** TorrentCard at top → stat grid → Quick Tools (4 colored buttons) → Files (1 purple button) → General Info table → Details table → Stats table → Advanced (16 rainbow buttons).

**v3 Vision:**

**Hero section:**
```
← Back                                    ⋯

Ubuntu 24.04 Desktop.iso

● Downloading · 8.4 MB/s ↓ · 2.1 MB/s ↑
████████████████████░░░░░░░░  72%

         23m remaining · 3.2 / 4.4 GB
```

Clean, spacious. Name is the title. State is a single line. Progress bar is prominent. ETA is centered below.

**Inline actions (2–3 max):**
```
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  ❚❚ Pause │  │  ⟳ Recheck│  │  🗑 Delete│
  └──────────┘  └──────────┘  └──────────┘
```

Three outlined buttons max. Accent color for primary action (Pause/Resume), red for Delete, secondary for Recheck. These are the only buttons. No "Quick Tools" section header needed — they're just *there*.

**Grouped inset sections:**

```
  GENERAL
  ┌─────────────────────────────────────┐
  │ Size                     4.4 GB     │
  │─────────────────────────────────────│
  │ Downloaded               3.2 GB     │
  │─────────────────────────────────────│
  │ Uploaded                 1.1 GB     │
  │─────────────────────────────────────│
  │ Ratio                    0.34       │
  │─────────────────────────────────────│
  │ Save Path         /data/downloads   │
  │─────────────────────────────────────│
  │ Category                 radarr   › │  ← tappable, opens picker
  │─────────────────────────────────────│
  │ Tags                     None     › │  ← tappable
  └─────────────────────────────────────┘

  TRANSFER
  ┌─────────────────────────────────────┐
  │ DL Speed                 8.4 MB/s   │
  │─────────────────────────────────────│
  │ UL Speed                 2.1 MB/s   │
  │─────────────────────────────────────│
  │ ETA                      23m        │
  │─────────────────────────────────────│
  │ DL Limit              Unlimited   › │  ← tappable, opens input
  │─────────────────────────────────────│
  │ UL Limit              Unlimited   › │  ← tappable
  └─────────────────────────────────────┘

  NETWORK
  ┌─────────────────────────────────────┐
  │ Seeds                    358/1885   │
  │─────────────────────────────────────│
  │ Peers                    27/105     │
  │─────────────────────────────────────│
  │ Availability             294.00     │
  └─────────────────────────────────────┘

  CONTENT
  ┌─────────────────────────────────────┐
  │ Files                    12 files › │  ← navigates to files screen
  │─────────────────────────────────────│
  │ Trackers                3 active  › │  ← navigates to trackers screen
  └─────────────────────────────────────┘

  ADVANCED
  ┌─────────────────────────────────────┐
  │ Priority                 Normal   › │  ← opens picker (Max/High/Normal/Min)
  │─────────────────────────────────────│
  │ Sequential Download          ○      │  ← toggle
  │─────────────────────────────────────│
  │ First/Last Piece Priority    ○      │  ← toggle
  │─────────────────────────────────────│
  │ Super Seeding                ○      │  ← toggle
  │─────────────────────────────────────│
  │ Force Start                  ○      │  ← toggle
  │─────────────────────────────────────│
  │ Rename                            › │  ← opens input
  │─────────────────────────────────────│
  │ Move to...                        › │  ← opens input
  └─────────────────────────────────────┘

  DATES
  ┌─────────────────────────────────────┐
  │ Added               Mar 11, 2026   │
  │─────────────────────────────────────│
  │ Completed           Mar 11, 2026   │
  │─────────────────────────────────────│
  │ Last Activity       Mar 14, 2026   │
  └─────────────────────────────────────┘
```

**What this replaces:** The entire "Quick Tools" (4 buttons) + "Advanced" (16 buttons) section. **16 rainbow buttons become ~12 native-feeling list rows.** Each row is tappable and does the right thing: toggles toggle, pickers open pickers, navigation rows navigate. This is how Apple's own Settings app works, and it's how the user already expects iOS apps to behave.

**The three-dot menu (⋯) in the nav bar** contains the less-common actions: Reannounce, Copy Magnet Link, Copy Hash. These don't need dedicated screen real estate.

### 4.3 Transfer Screen

**Current:** Dashboard with CURRENT SPEED, QUICK ACTIONS (6 colored squares), STATISTICS, SPEED LIMITS (preset chips), CONNECTION info.

**v3 Vision:**

**Hero speed display:**
```
         ↓ 8.4 MB/s
         ↑ 2.1 MB/s

    ┌─── speed graph (last 60s) ───┐
    │  ╱╲    ╱╲╱╲                  │
    │╱╱  ╲╱╱╱    ╲╱╲              │
    └──────────────────────────────┘
```

The speeds are large (34pt bold) and centered. The graph sits below, spanning the full width. **No "CURRENT SPEED" label needed** — the numbers speak for themselves. The graph uses a subtle gradient fill (accent color at 15% opacity) with a crisp line on top.

**Speed limits (inline):**
```
  SPEED LIMITS
  ┌─────────────────────────────────────┐
  │ Download Limit       Unlimited    › │
  │─────────────────────────────────────│
  │ Upload Limit         Unlimited    › │
  │─────────────────────────────────────│
  │ Alternative Speeds        ○         │
  └─────────────────────────────────────┘
```

Tapping "Download Limit" opens a bottom sheet with the preset values AND a custom input. Not a grid of 9 chips — a clean list with the current selection checkmarked, like iOS Settings > Wi-Fi shows networks.

**Quick actions:** Reduce from 6 buttons to a clean grouped section:
```
  ACTIONS
  ┌─────────────────────────────────────┐
  │ ▶  Resume All                       │
  │─────────────────────────────────────│
  │ ❚❚ Pause All                        │
  │─────────────────────────────────────│
  │ ⚡ Force Start All                   │
  └─────────────────────────────────────┘
```

"Pause All DL" and "Pause All UL" are removed — they're power-user actions that belong behind a long-press on "Pause All" or in a sub-menu. Simplify the default surface.

**Statistics:**
```
  THIS SESSION
  ┌─────────────────────────────────────┐
  │ Downloaded               12.23 GB   │
  │─────────────────────────────────────│
  │ Uploaded                  2.06 GB   │
  └─────────────────────────────────────┘

  ALL TIME
  ┌─────────────────────────────────────┐
  │ Downloaded              430.01 GB   │
  │─────────────────────────────────────│
  │ Uploaded                108.67 GB   │
  │─────────────────────────────────────│
  │ Global Ratio               0.25    │
  └─────────────────────────────────────┘

  CONNECTION
  ┌─────────────────────────────────────┐
  │ Status                 Connected ●  │
  │─────────────────────────────────────│
  │ DHT Nodes                    109    │
  │─────────────────────────────────────│
  │ Peers                          4    │
  │─────────────────────────────────────│
  │ Free Disk Space          2.26 TB    │
  └─────────────────────────────────────┘
```

### 4.4 Settings

**Current:** Single long scroll, 10+ sections, red disconnect button, colored toggles, all-caps section headers.

**v3 Vision:** Break into sub-screens via navigation. The top-level Settings screen should show ~6 rows max:

```
  ┌─────────────────────────────────────┐
  │ 🟢 PiratePi                        │
  │    torrent.piratepi.tv   Connected  │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ Servers                           › │
  │─────────────────────────────────────│
  │ Appearance                        › │
  │─────────────────────────────────────│
  │ Torrent Defaults                  › │
  │─────────────────────────────────────│
  │ Notifications                     › │
  │─────────────────────────────────────│
  │ Advanced                          › │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ What's New                        › │
  │─────────────────────────────────────│
  │ Send Feedback                     › │
  │─────────────────────────────────────│
  │ About qRemote                     › │
  └─────────────────────────────────────┘

              qRemote v3.0.0
```

Each row navigates to a focused sub-screen. "Servers" shows the server list with add/edit/delete. "Appearance" shows theme, card view, colors. "Torrent Defaults" shows sort, filter, pause-on-add, save path. "Advanced" shows API timeout, retries, debug, logs, backup/restore, danger zone.

The current server card at the top provides at-a-glance connection status. Tapping it navigates to server detail / disconnect.

### 4.5 Onboarding

**Current:** Horizontal pager with 4 slides, mock UI components, "Next" and "Skip" buttons.

**v3 Vision:** The onboarding is actually pretty good already — the mock UI components are a nice touch. For v3:

- Use a **full-bleed gradient background** per slide (not flat black)
- Add **Lottie animations** instead of static mockups — a torrent downloading, a speed graph animating, files organizing
- The final slide should have a **prominent "Add Your Server" button** that goes directly to server setup, not a generic "Get Started"
- Reduce to 3 slides max. The current 4th slide ("Organize") is weak.

### 4.6 Add Server

**Current:** Form with text inputs, connection test button, debug panel.

**v3 Vision:** Present as a **full-screen modal** (iOS page sheet style). Clean, focused form:

```
  ┌─────────────────────────────────────┐
  │ Name                      My Server │
  │─────────────────────────────────────│
  │ Host              192.168.1.100     │
  │─────────────────────────────────────│
  │ Port                         8080   │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ Username                    admin   │
  │─────────────────────────────────────│
  │ Password                    •••••   │
  └─────────────────────────────────────┘

  ┌─────────────────────────────────────┐
  │ Use HTTPS                      ○    │
  └─────────────────────────────────────┘

       ┌──────────────────────┐
       │    Test Connection    │
       └──────────────────────┘
```

The test connection button shows an inline animated result (checkmark animation on success, shake + red on failure). No separate debug panel by default — a "Show Debug Info" disclosure at the bottom for power users.

---

## 5. Interaction & Motion Design

### 5.1 Spring Animations Everywhere

Replace all `Animated.timing` with spring-based animations (via `react-native-reanimated`):

```typescript
const springConfig = {
  damping: 20,
  stiffness: 300,
  mass: 0.8,
};
```

Apply to:
- Card press feedback (scale to 0.98)
- Sheet presentation
- Tab switches
- Filter selection
- Pull-to-refresh overshoot

### 5.2 Haptic Feedback Map

```
Light:      Filter chip tap, toggle switch, list row selection
Medium:     Pull-to-refresh threshold, swipe action threshold, long press
Success:    Torrent added, connection successful, action completed
Error:      Connection failed, delete confirmed
Selection:  Checkbox toggle, multi-select
```

### 5.3 Swipe Gestures

Adopt the Mail/Apollo swipe pattern for torrent cards:

- **Short swipe left:** Pause/Resume (amber/green background)
- **Full swipe left:** Delete (red background)
- **Short swipe right:** Priority (blue background)

Each swipe reveals the action icon + label. The icon scales up as the swipe progresses. Haptic fires at the action threshold.

### 5.4 Native Context Menus

Replace the custom popup menu (`Modal` + `measureInWindow` + manual positioning) with iOS `ContextMenu` previews:

- Long-press a torrent card → card lifts with blur backdrop → context menu appears
- Menu items: Resume/Pause, Force Start, Priority (submenu: Max/High/Normal/Min), Copy Magnet, Verify Data, Reannounce, Delete (destructive)

This replaces 100+ lines of manual menu positioning code with a native API that works perfectly, includes accessibility for free, and feels like the OS.

### 5.5 Bottom Sheets

Replace `Modal` with bottom sheets (via `@gorhom/bottom-sheet` or similar) for:
- Add torrent form
- Speed limit picker
- Sort/filter options
- Priority picker
- Limit input

Bottom sheets are the iOS-native pattern for secondary inputs. They maintain spatial context (the list is still visible behind), they're draggable, and they support keyboard avoidance automatically.

### 5.6 Scroll Behavior

**Large title collapse:** The screen title starts as a 34pt bold large title and collapses into the navigation bar on scroll — exactly like iOS Settings, Health, and App Store. This gives a premium, platform-native feel.

**Header hide/show:** The current manual scroll-direction-based header show/hide (with 15px threshold and animation locking) should be replaced by the native `headerLargeTitle` behavior, which handles this automatically with correct physics.

---

## 6. The "Wow Factor" Moments

These are the details that make users say "oh, that's nice" and tell their friends.

### 6.1 Live Activity–Style Speed Widget

When a torrent is downloading, show a **compact persistent indicator** at the top of the screen (like a Dynamic Island / Live Activity) showing the total download speed. It's always visible, gently pulsing when active.

### 6.2 Completion Celebration

When a torrent reaches 100%, show a **subtle confetti burst** (already partially implemented!) with a satisfying haptic. The card's progress bar fills with a smooth animation and the state dot transitions from blue to green with a scale bounce.

### 6.3 Connection Handshake Animation

When connecting to a server, instead of a spinner, show a **custom animation** — two dots moving toward each other, connecting, and becoming one. Takes 1–2 seconds. Makes the connection feel intentional and satisfying.

### 6.4 Speed Graph Gesture

The speed graph on the Transfer screen should be **interactive**: drag your finger across it to scrub through the history, showing the exact speed at each point in time with a tooltip. Like the stock chart in Apple's Stocks app.

### 6.5 Pull-to-Refresh With Character

Instead of the default spinner, use a **custom pull-to-refresh indicator** — maybe a stylized download arrow that fills up as you pull, then animates into a spinning refresh icon. Small touch, big impression.

### 6.6 Torrent Card → Detail Shared Element Transition

When tapping a torrent card, the card **expands into the detail view** using a shared element transition. The name, progress bar, and state dot animate from their card positions to their detail-view positions. When you go back, they animate back. This creates a spatial model that makes the app feel like a physical space.

### 6.7 The Empty State

When there are no torrents:

```
              ⬇️
        (stylized arrow icon, not generic)

      Nothing downloading yet

    Tap + to add a torrent or magnet link
```

Clean, minimal, confident. One icon, one line, one instruction. No subtitle. No "add a server to set sail 🏴‍☠️" — save the personality for moments that earn it.

---

## 7. Implementation Roadmap

### Phase 1: Foundation (2–3 weeks)

| Task | Impact | Effort |
|------|--------|--------|
| Define new color system (4 semantic colors, 3 surface tiers) | High | Low |
| Define new typography scale (SF Pro, 10 sizes) | High | Low |
| Remove all shadows in dark mode; simplify light mode | Medium | Low |
| Replace FAB with nav bar "+" button | High | Low |
| Replace custom popup menu with native ContextMenu | Very High | Medium |
| Redesign TorrentCard (4-line layout, remove stat grid) | Very High | Medium |
| Replace chip filters with scope bar | High | Medium |

### Phase 2: Screens (3–4 weeks)

| Task | Impact | Effort |
|------|--------|--------|
| Redesign torrent detail (grouped inset lists, remove rainbow buttons) | Very High | High |
| Redesign transfer screen (hero speeds, grouped sections) | High | Medium |
| Redesign settings (sub-screen navigation) | High | High |
| Add bottom sheet for add-torrent, speed limits, pickers | High | Medium |
| Implement swipe actions on torrent cards | High | Medium |
| Implement large title collapse on all screens | Medium | Low |

### Phase 3: Motion & Polish (2–3 weeks)

| Task | Impact | Effort |
|------|--------|--------|
| Migrate all animations to Reanimated springs | Medium | Medium |
| Add shared element transition (card → detail) | Very High | High |
| Add haptic feedback map | Medium | Low |
| Design and implement custom pull-to-refresh | Medium | Medium |
| Add completion celebration animation | Medium | Low |
| Add connection handshake animation | Medium | Medium |
| Interactive speed graph (scrub gesture) | Medium | High |

### Phase 4: Personality (1–2 weeks)

| Task | Impact | Effort |
|------|--------|--------|
| Redesign empty states | Medium | Low |
| Redesign onboarding (Lottie animations, 3 slides) | Medium | Medium |
| Design app icon refresh | High | Medium |
| Add custom SF Symbol–style icon set | Medium | Medium |

---

## Summary: The One-Sentence Pitch

> **v3 is the version where qRemote stops being a utility that shows data and becomes an app that feels like it was designed by someone who loves both torrenting and great software.**

The current app has ~23,000 lines of working functionality. That's the hard part and it's done. The v3 redesign isn't about adding features — it's about **removing visual noise, embracing the platform, and adding the 200 small details that make users fall in love**.

Kill the rainbow buttons. Kill the FAB. Kill the stat grid. Kill the custom popup menu. Trust the platform. Trust the content. Trust the user.

*"Design is not just what it looks like and feels like. Design is how it works." — Steve Jobs*

---

*Generated from a full design audit on 2026-03-14.*
