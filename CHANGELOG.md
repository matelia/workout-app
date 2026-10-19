# Changelog

## Unreleased: Phase 1 (Workouts MVP)

### Feature 1: Foundation + Library (2026-10-19)
- Pinned to SDK 57 because the App Store Expo Go (57.0.9) cannot open SDK 58 projects.
- Expo SDK 57 + TypeScript + Expo Router project; routes live in `src/app/`.
- Six bottom tabs: Today, Food, Workouts, Library, Mind, Progress. Food, Mind and Progress are placeholders until their phases.
- SQLite database with a migration runner based on `PRAGMA user_version`.
  - `001_initial` creates every table from the approved schema (all phases).
  - `002_seed_exercises` adds 14 starter exercises.
- Light/dark theme follows the iPhone setting.
- Library:
  - Exercise list with a search bar, muscle-group filter chips, and sections by muscle group.
  - Add, edit and remove exercises. Removing archives the exercise so logged history is kept.
  - Video can be a YouTube link (embedded player), a public Instagram post or reel (embedded), or a local video file (copied into the app, played with expo-video).

### Calendar import (2026-10-19)
- Migration `003_calendar_import` adds 39 exercises from the "Gym (…)" Google Calendar events. Variants such as "(machine / barbell)" are split into separate exercises.
- Creates three routines from those events: **Back & Shoulder** (15), **Upper Body** (17), **Legs & Abs** (7).
- Archives the generic starter exercises from 002, except Dumbbell Curl and Leg Press, which are also on the calendar list.
- New muscle groups: Traps, Forearms, Hamstrings, Calves.

### Feature 2: Routines (2026-10-19)
- Workouts tab lists routines with their exercise counts. Tap **+** to create one.
- Routine editor: rename, set target sets and reps with −/+ steppers, reorder with ↑/↓, remove exercises, delete the routine (archived, so history is kept).
- "Add exercises" picker: search the library and tap to select several at once. They're added in the order you tapped, and exercises already in the routine are marked.
- Turned off Expo Router's typed-routes experiment; its generated types went stale while the dev server was running.

### Feature 3: Schedule & reminders (2026-10-19)
- Workouts → Weekly schedule: put routines on weekdays (Monday first) or on one-off dates, each with an optional reminder time.
- Migration `004` pre-fills the schedule from your calendar: Mon Back & Shoulder 6:05, Tue Upper Body 6:05, Thu Legs & Abs 7:30. It also creates the empty targets row.
- Reminders are local notifications, rebuilt from the database at launch and after every edit. Tapping one opens Today.

### Feature 4: Logging, rest timer, Today (2026-10-19)
- Start a routine (or an empty workout) to open a full-screen logger.
  - Sets are pre-filled from the same set number last time.
  - One tap on ✓ logs a set.
  - Weight and reps are editable inline. Add a set (it copies the previous one), long-press a set number to delete it, or add more exercises.
  - Each exercise shows "Last: …" from its previous session.
  - Finishing drops unchecked sets; you can also discard the whole workout.
  - Finished workouts appear in History and can still be edited.
- Rest timer:
  - starts automatically when you check off a set
  - −15/+15 adjust it and become your new default
  - buzzes in the app, or sends a "Rest over" notification when the phone is locked
- Today: scheduled workout with Start/Resume/Done, a resume card for a workout in progress, and a rest-day state.

## Phase 1 complete

## Phase 2: Mind (2026-10-19)
- **Face ID lock.** Mind asks for Face ID on open and relocks whenever the app goes to the background. Phones with no passcode set skip the lock.
- **Care items:**
  - categories: meds, skincare, hair care, other
  - multiple times per day and chosen weekdays
  - a required neutral **lock-screen label**, with a warning if it contains the item's name
  - Done/Skip/Undo per slot, plus a history list
  - removing an item stops its reminders and keeps its history
- **Daily check-in** (about 30 seconds):
  - mood 1–5 and energy 1–5 as tap targets
  - hours slept in 0.5 steps
  - tags (with custom ones)
  - an optional one-line note
  - one check-in per day; saving again overwrites it
- **Journal:** free-form entries with a "Bring to therapy" switch.
- **Therapy sessions:** date, notes, takeaways, homework.
- **Before next session:**
  - last session's homework
  - mood trend and averages since that session
  - all flagged journal entries
- **Export for therapist:**
  - pick a date range, plus check-ins, journal (flagged only or all) and session notes
  - creates a .txt file and opens the share sheet; never uploads anything
- Today shows care still due using only the neutral labels.

## Phase 3: Food (2026-10-19)
- **Daily log:** grouped by breakfast, lunch, dinner and snacks, with ‹ › day navigation. Tap an entry to edit or delete it.
- **Totals:** calories and protein bars against targets, plus a carbs and fat line.
- **Barcode scan:**
  - checks the local database first, then Open Food Facts
  - unknown barcodes go to manual entry and are remembered
- **USDA FoodData Central search:**
  - works with `DEMO_KEY`, or your own free key set in Food → Settings
  - results without macros are filtered out
- **Recent foods:** one tap re-logs one at its last amount.
- **Manual foods:** enter per-100 g or per-serving values; they're converted to per 100 g.
- **Saved meals and meal-prep batches:**
  - enter the whole batch and its servings once, then log by servings (0.5 steps)
  - a saved meal that's already in the log can't be deleted
- **Settings:** daily targets for kcal, protein, carbs and fat.

## Phase 4: Snapshot pipeline (2026-10-19)
- **Server (`server/`):** FastAPI + local Ollama vision model (default `qwen2.5vl:7b`).
  - `/label` reads label values and converts them to per 100 g.
  - `/meal` returns only food names and grams; the server matches each in USDA (no model calorie guesses).
  - optional shared token; photos are never stored
- **App:**
  - Snapshot screen: label or meal, camera or library
  - the photo is copied into the app and a `snapshot_job` is created, then it's sent to the laptop
  - an editable **review screen** always comes before saving
  - an unreachable laptop means the photo is **queued**; it retries at launch, whenever the app returns to the foreground, or from Food → Snapshot queue
- Migration `005` adds `date`, `meal` and `error` columns to `snapshot_job`, so queued photos are logged to the right day and meal.
- Food → Settings: server address, token, and a "Test connection" button.

## Phase 5: Progress (2026-10-19)
- **Lift chart per exercise:** top set, estimated 1RM (Epley) or volume per session.
- **Weekly daily-average** calories and protein for the last 8 weeks, with a target line.
- **Mood trend** for 30 days. It's shown only after Face ID, because it's Mind data.
- **Body weight log** (one entry per day) with a chart.
- **CSV export** of workout sets, food log, body weight, and library & routines. Mind data is never included.

## Phase 6: Real install (2026-10-19)
- `.github/workflows/ios-build.yml`:
  - runs on `macos-15` with the latest stable Xcode
  - `expo prebuild`, then an unsigned Release `xcodebuild`
  - packages `Workout.ipa` and uploads it as an artifact
- `plugins/withoutPushEntitlement.js` removes `aps-environment` so a free Apple ID can sign the app. It only uses local notifications.
- `app.json`:
  - camera, photos and Face ID permission text
  - App Transport Security exceptions for plain-HTTP Tailscale addresses (`NSAllowsLocalNetworking`, `*.ts.net`)
  - `/ios`, `/android` and build outputs are git-ignored
- `INSTALL.md` covers:
  - GitHub → SideStore install steps
  - the 7-day refresh
  - switching between the Tailscale and SideStore VPNs
  - a post-install checklist

## Batch: feedback round 1 (2026-10-19)
- **Library:**
  - The exercise screen now has an **Edit exercise** button in the page itself, not only in the header.
  - Notes are now **"How to do it"**, and empty exercises suggest adding a video and how-to steps.
- **Snapshot queue:**
  - While the app is open, queued photos are retried every 2 minutes, as well as at launch and when the app returns to the foreground.
  - A "Snapshot ready to review" notification links straight to the review screen.
  - Queued photos are stored in SQLite and the documents folder, so nothing is lost if the app closes.
- **Mind check-in redesign:**
  - Step 1, "How are you?": five drawn mood faces (rad, good, meh, bad, awful), with a tappable date for backfilling.
  - Step 2, "What have you been up to?":
    - an emotions grid with icons and custom emotions (+)
    - energy and sleep
    - a quick note with "Open Full Note" to the journal
    - a photo (camera or gallery)
    - a **voice memo** recorded with expo-audio
  - Mind home shows today's mood face.
- **Body photos (Progress → Body photos):**
  - front, side and back photos by date, behind Face ID and never exported
  - side-by-side compare of any two dates per pose
  - edit or delete a photo
  - **monthly reminder**, defaulting to the 18th at 9:00 to match your calendar's progress-photo event; the notification just says "Progress photo"
- **Body metrics (Progress → Body metrics):**
  - a new `body_metric` table holds one row per measurement minute; existing weigh-ins are copied in
  - **Apple Health** read-only sync of weight, body fat, lean mass and BMI. Renpho writes these when its Health sync is on. It's installed-app only, because HealthKit isn't in Expo Go, and it re-syncs at every launch once connected.
  - **Renpho CSV import** adds skeletal muscle, muscle mass, visceral fat, body water, bone mass, BMR and metabolic age. Columns are matched by keyword and kg is converted to lb. The same weigh-in from Health and from the CSV is merged into one row.
  - tiles for the latest values, a chart for any metric, manual weigh-ins, and long-press to delete
- Migration `006` adds check-in photo, audio and time columns, plus the `progress_photo` and `body_metric` tables.
- The CSV export's "Body weight" is now "Body metrics" (all fields).
- **New dependencies:**
  - `expo-audio`, `expo-asset`
  - `@kingstinct/react-native-healthkit` 16.2.0 and `react-native-nitro-modules`
- **Config:** microphone and Apple Health permission text. HealthKit background delivery and the write permission are off.

## Batch: feedback round 2 (2026-10-19)
- **Floating + buttons** (bottom-right) on Journal, Therapy sessions, Care items, Saved meals, Workouts (new routine) and Library. The header "+" buttons are gone.
- **Library content** for all 39 calendar exercises (migration `007`):
  - **How to do it:** setup, numbered steps and cues.
  - **A short YouTube tutorial**, chosen as the most-viewed embeddable result under 4 minutes from established channels (ScottHermanFitness, Buff Dudes, LIVESTRONG, Howcast, Renaissance Periodization, …).
  - **Equipment:** Barbell, Dumbbell, Cable, Machine, Bodyweight, Band, Landmine or Other.
  - **Muscles worked:** primary and secondary, shown on a front and back **body diagram** (`react-native-body-highlighter`, MIT, pure JS, works in Expo Go).
  - It only fills in blanks: your own notes, videos or equipment are kept.
  - Interpretations to check: "Dumbbell Shoulder Raise" was set up as a front raise, "Rowing" as a seated cable row, and "Barbell Rear Delt Raise" as a rear delt row.
- **Library filters:** a muscle row and a new multi-select **equipment** row. Rows show their equipment.
- **Exercise editor:** equipment picker, plus muscle chips (tap to cycle primary, secondary, off) with a live diagram preview.

## Batch: groceries and meal parts (2026-10-19)
- **My groceries** (Food → My groceries, migration `008` adds `pantry_item`):
  - the products you actually buy, grouped by store (Costco, Wegmans, Whole Foods, … plus custom stores)
  - add by **barcode scan** (fills in the name, nutrition, serving size and a product type from Open Food Facts), by search, or manually
  - each has a **"what is it"** type used for matching (e.g. "peanut butter"), optional extra words, a serving ("1 slice = 28.5 g"), and an in-rotation switch
  - scanning something you already have marks it bought again
- **Snapshot matching:**
  - each food the model sees is matched to your groceries
  - a clear match is used automatically ("🛒 your Whole Foods peanut butter"); a partial match is only suggested ("Is this your Costco black beans?")
  - "Not this?" switches to another grocery or back to USDA
  - main words must agree both ways, so rice ≠ rice cakes and coffee creamer ≠ coffee
  - the app sends your grocery types to the laptop, and the model is told to use those exact names
- **Label snapshots:** an "Add to my groceries" option with store and type.
- **Search:** "My groceries" appear first; with no search text, your in-rotation products are listed.
- **Amount screen:** serving buttons (½, 1, 2, 3, 4 slices/tbsp…) when the product has a serving.
- **Meals in parts:**
  - after saving a snapshot, "Snap next part" opens the camera for the same day and meal
  - the Food log groups snapshot entries into "Snapshot part 1, 2, …" with the photo and a subtotal; parts add up in the meal total
  - each meal also gets a "+ Snap next part" link
- USDA `DEMO_KEY` is limited to about 10 requests an hour. The app and server text now say so, and the server logs a hint.

## Batch: easier editing and healthy-eating check (2026-10-19)
- **Swipe left for Edit/Delete** on Food log entries, saved meals and groceries (`react-native-gesture-handler` ReanimatedSwipeable; the app root is now wrapped in `GestureHandlerRootView`).
- **No more keyboard trap:**
  - every screen closes the keyboard when you drag and scrolls content above it
  - editing an existing food entry no longer opens the number pad automatically
- The Food tab's ⚙︎ header button stayed visible on child screens. It's now a "Targets & settings" row on the Food page.
- **More nutrients** (migration `009`):
  - fiber, sugar, saturated fat and sodium on foods, read from barcodes (Open Food Facts), USDA search, nutrition-label snapshots and the server's USDA matches
  - manual entry has optional fields; the review screen has a "Fiber, sugar, sat. fat, sodium" toggle
  - updating a food from a source without these keeps the values already stored
- **Daily goal and limits** (Targets & settings): fiber ≥ 30 g, sugar ≤ 50 g, saturated fat ≤ 22 g, sodium ≤ 2,300 mg. These are US Dietary Guidelines defaults for ~2,000 kcal and can be edited or cleared.
- **Healthy-eating check:**
  - a Food tab card with bars for fiber, fat, saturated fat, sugar and sodium (amber when close, red when over) and plain-language tips
  - Today shows only what needs attention
  - snapshot review warns when a part would push you over a limit
- **Grocery matching:**
  - a snapshot's food that's fully contained in your product's type is at least suggested ("coffee" → your Tim Hortons coffee)
  - new product types default to the last two words of the name, with a "keep it short" hint
- The food CSV export includes fiber, sugar, saturated fat and sodium.

## Batch: restaurants (2026-10-19)
- **Food → Restaurants:**
  - Chick-fil-A and Starbucks to start (with links to their official nutrition pages); add or remove your own restaurants
  - each restaurant lists your saved items; tap one to log "1 item", or swipe to edit or delete
  - **add items** by searching the chain in USDA (fast-food "SR Legacy" items and branded products, with the item weight when USDA lists it), or by entering values per item straight from the chain's nutrition info
- **How it's stored:** restaurant items are grocery-table rows with `place_type = 'restaurant'` (migration `010`). They show up in Food search ("My groceries & restaurants") and in snapshot matching, so a snapped "chicken sandwich" suggests your Chick-fil-A one. My groceries lists only grocery items.
- **Food log amounts:** "2 slices (57 g)" or "1 item" when the food has a serving; plain grams otherwise.
- USDA search hits carry serving info: SR Legacy food measures ("3 strips = 135 g" becomes 1 strip = 45 g), or Branded serving size in grams.

## Design: "Steady" (2026-10-19)
- **The app is now called Steady.** The bundle ID is `com.matin.steady` and the URL scheme is `steady`.
- **New look ("bold sport"):**
  - always dark: near-black surfaces, lime as the single action color, coral as the second data color
  - Barlow Condensed for titles, labels, buttons and big numbers; the iPhone's own font for body text
- **Shared building blocks:**
  - borderless cards and rows
  - buttons with condensed uppercase text and a press animation
  - lime selected chips
  - one shared header style for every screen stack (`stackScreenOptions`), and a dark tab bar with a lime active tab
- **Today, rebuilt:**
  - a big "TODAY" header and date
  - a lime "START WORKOUT →" card for each scheduled routine (or "Resume" / "Done ✓")
  - calorie (lime) and protein (coral) rings with big numbers, kcal left, and the healthy-eating check
  - quick-add tiles and Care
- **Leftover colors fixed:** check marks and Done buttons on lime use dark marks; protein bars and chart target lines use coral; the Mind check-in accent is lime (mood faces keep their own colors).
- **New icon and splash:** lime and coral activity-style rings on black. The source is `design/icon.html`; the mockups are in `design/`.
- The iOS build artifact is now `Steady.ipa`.
