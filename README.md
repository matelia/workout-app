# Workout

Personal iPhone app for workouts, food, and self-care. All data stays on the phone in SQLite.

- **Scope and phases:** [SPEC.md](SPEC.md)
- **History:** [CHANGELOG.md](CHANGELOG.md)
- **Real install:** [INSTALL.md](INSTALL.md)
- **Laptop snapshot server:** [server/README.md](server/README.md)

**Stack:** Expo SDK 57, React Native, TypeScript, Expo Router, expo-sqlite. Develop in **Expo Go** on Windows; no Mac needed.

## Setup (Windows)

1. Install [Node.js LTS](https://nodejs.org) (v20+).
2. On your iPhone, install **Expo Go** from the App Store.
   - The project targets **SDK 57**, matching the App Store Expo Go (57.0.9 as of 2026-10-19).
   - Only upgrade the SDK once the App Store Expo Go supports the new one.
3. Sign in to the same free Expo account on both devices:
   - **iPhone:** in Expo Go, tap the profile icon.
   - **PC:** run `npx expo login`.
4. In this folder, using **cmd**. In PowerShell, use `npx.cmd`/`npm.cmd` instead, because PowerShell blocks `npx.ps1` by default.

   ```bash
   npm install
   npx expo start
   ```

5. Connect the phone:
   - Put the phone and PC on the **same Wi-Fi**.
   - Scan the QR code with the iPhone **Camera** and open it in Expo Go.
   - If Windows Firewall asks about Node.js, allow it on Private networks.
   - If it can't connect, use `npx expo start --tunnel`.
6. Edits hot-reload on the phone. Shake the phone to open the dev menu and reload.

## What's in each tab

| Tab | Features |
| --- | --- |
| **Today** | <ul><li>Today's scheduled workout with Start/Resume</li><li>Calories and protein vs targets</li><li>Quick-add: snapshot, barcode, saved meal, check-in</li><li>Care items still due, shown with neutral labels only</li></ul> |
| **Food** | <ul><li>Daily log grouped by meal, with day-by-day navigation</li><li>Barcode lookup (Open Food Facts)</li><li>USDA search</li><li>Manual foods</li><li>Saved meals and meal-prep batches, logged per serving</li><li>My groceries: products you buy (by store), which snapshots and search prefer</li><li>Snapshot (label or meal photo) with review screen and offline queue; meals can be logged in parts</li><li>Targets and settings (⚙︎)</li></ul> |
| **Workouts** | <ul><li>Routines (create, reorder, target sets × reps)</li><li>Weekly or one-off schedule with reminder notifications</li><li>Set logger pre-filled from last time: one tap per set</li><li>Rest timer that notifies you on the lock screen</li><li>History</li></ul> |
| **Library** | <ul><li>Exercises with muscle group, how-to instructions, and video (YouTube, Instagram, or a local file)</li></ul> |
| **Mind** | <ul><li>Face ID lock</li><li>30-second check-in: mood faces, emotions, energy, sleep, note, photo and voice memo</li><li>Journal with a "bring to therapy" flag</li><li>Therapy notes</li><li>Pre-session view</li><li>Care items (meds, skin, hair, other) on their own schedules, with Done/Skip and history</li><li>Export for therapist</li></ul> |
| **Progress** | <ul><li>Lift charts: top set, estimated 1RM, volume</li><li>Weekly calorie and protein averages</li><li>Mood trend, behind Face ID</li><li>Body metrics from Apple Health, Renpho CSV import, or manual weigh-ins</li><li>Private body photos with monthly reminder and side-by-side compare</li><li>CSV export (never includes Mind data)</li></ul> |

## Useful commands

| Command | What it does |
| --- | --- |
| `npx expo start` | Dev server + QR code |
| `npx expo start -c` | Same, but clears the bundler cache |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npx expo-doctor` | Checks dependency versions |
| `npx expo install <pkg>` | Add a package (picks the SDK-compatible version) |

## Project layout

```
src/
  app/                    Expo Router routes (each file = a screen)
    _layout.tsx           DB + migrations, Face ID provider, reminder sync, notification taps, snapshot retries
    (tabs)/               index (Today) · food/ · workouts/ · library/ · mind/ · progress/
    session/              workout logger (full screen) + add-exercise picker
  db/
    migrate.ts            migration runner (PRAGMA user_version)
    migrations/           001 schema · 002 starter exercises · 003 calendar import · 004 schedule · 005 snapshot date/meal · 006 check-in media, body photos, body metrics · 007 exercise equipment/muscles · 008 groceries
    repos/                typed queries per area
  components/  hooks/  lib/  theme/
server/                   FastAPI + Ollama snapshot server for the home laptop
plugins/                  Expo config plugin (strips the push entitlement for free-Apple-ID signing)
.github/workflows/        macOS build of an unsigned .ipa for SideStore
```

## Database and migrations

- The database file is `app.db` inside the app's sandbox.
- To change the schema, **add** a new file in `src/db/migrations/` and register it in `src/db/migrate.ts`. Never edit a migration that has already run on your phone.
- To wipe everything while developing, remove the project from Expo Go and reinstall it.

## Privacy

- **Nothing leaves the phone except:**
  - food searches and barcodes, sent to USDA and Open Food Facts
  - snapshot photos, sent only to *your* laptop over Tailscale
  - Apple Health is read on the phone only; nothing is written back to it
  - YouTube and Instagram embeds, which load when you open an exercise
- **Mind data:**
  - is never sent anywhere and is excluded from the CSV export
  - is only shared when you use *Export for therapist*, which hands a text file to the iOS share sheet
- **Lock-screen notifications** for care items show only the neutral label you choose.
- **Body photos** stay on the phone behind Face ID and are never exported.
