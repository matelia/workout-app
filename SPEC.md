# SPEC — Personal Workout / Food / Self-care App

Personal iPhone app to track workouts, food, and self-care. This file is the source of truth for scope; build phase by phase.

## Constraints
- I develop on Windows. Use Expo (React Native + TypeScript) with Expo Router, and keep everything compatible with Expo Go for now.
- No paid services. No paid AI APIs.
- All data stored locally on the phone with expo-sqlite, with a simple migration system.
- Units: lb for weight, kcal and grams for food.
- Final install will be via a GitHub Actions macOS build (.ipa) + SideStore with a free Apple ID. Don't worry about that until Phase 6.

## Tabs (bottom tabs)
Today, Food, Workouts, Library, Mind, Progress.

### Today
- Today's scheduled workout with a Start button
- Calories and protein so far vs. my daily targets
- Quick-add: food snapshot, barcode, saved meal, mood check-in
- Care reminders still due today

### Food
- Snapshot a meal or nutrition label (see Snapshot pipeline)
- Barcode scan for packaged food (Open Food Facts API, free)
- Manual entry with USDA FoodData Central search (free API key)
- Saved meals and meal-prep batches: enter a batch once, log it per serving
- Daily log grouped by meal, editable later

### Workouts
- Build routines (e.g. Push/Pull/Legs) from Library exercises
- Schedule routines on weekdays with local notification reminders (expo-notifications)
- Logging screen: sets, reps, weight, pre-filled from last session of that exercise
- Rest timer between sets
- Logging a set should take one or two taps

### Library
- Exercises: name, muscle group, notes, video
- Video = YouTube link in an embedded YouTube player, public Instagram post via embed in a WebView, or a local video file played with expo-video
- Default to links, not downloads

### Mind (private)
- Locked with Face ID (expo-local-authentication)
- Daily check-in (~30 seconds): mood 1-5, energy 1-5, hours slept, tags, optional one-line note
- Journal: free-form entries, each with a "bring to therapy" flag
- Therapy sessions: date, notes, takeaways, homework
- Pre-session view: all flagged entries + mood trend since the last session
- Care reminders: meds, skincare (AM/PM), hair care, custom routines, each on its own schedule; Done or Skip, with history
- Privacy rules: Mind data is never sent to any server, is excluded from the default CSV export, and has its own "Export for therapist" option for a chosen date range
- Lock-screen notifications use neutral labels I choose (e.g. "Evening routine"), never med names or journal text

### Progress
- Weight per exercise over time
- Weekly calories and protein averages
- Mood trend
- Optional body weight log
- CSV export of everything except Mind data

## Snapshot pipeline (free, Phase 4)
- Runs on my spare Windows laptop at home, reached over Tailscale
- Small FastAPI server on the laptop passes photos to a local Ollama vision model
- Label photo: model reads the label into nutrition fields
- Meal photo: model returns JSON only (food names + estimated grams, no calorie guesses); server looks up each food in USDA FoodData Central and multiplies by grams
- App always shows a review screen before saving
- If the laptop is unreachable, queue the photo (SnapshotJob) and process it later
- Barcodes and saved meals never need the laptop

## Data model (SQLite tables)
- Exercise: id, name, muscle_group, notes, video_type (youtube/instagram/file), video_url_or_path
- Routine: id, name
- RoutineExercise: id, routine_id, exercise_id, order, target_sets, target_reps
- ScheduledWorkout: id, routine_id, weekdays or date, reminder_time
- WorkoutSession: id, routine_id, date, start_time, end_time
- SetLog: id, session_id, exercise_id, set_number, reps, weight_lb, done
- MoodCheckIn: id, date, mood, energy, sleep_hours, tags, note
- JournalEntry: id, datetime, text, bring_to_therapy
- TherapySession: id, date, notes, takeaways, homework
- CareItem: id, name, category (meds/skin/hair/other), schedule_times, notification_label
- CareLog: id, care_item_id, scheduled_time, done_time, skipped
- Food: id, name, source (usda/off/manual), barcode, kcal/protein/carbs/fat per 100g
- SavedMeal: id, name, items (food_id + grams), servings_per_batch
- FoodLog: id, date, meal (breakfast/lunch/dinner/snack), food_id or saved_meal_id, grams or servings, photo_path
- SnapshotJob: id, photo_path, status (queued/processing/needs_review/done), model_output_json
- Targets: daily kcal, protein, carbs, fat

## Build phases
1. Workouts MVP: Library, routines, weekly schedule with reminders, set logging with pre-fill, rest timer, Today tab showing today's workout.
2. Mind tab: care reminders first, then check-in, journal, therapy notes, Face ID lock, therapist export.
3. Food basics: barcode via Open Food Facts, USDA search, saved meals and prep batches, daily totals vs. targets.
4. Snapshot server: FastAPI + Ollama on the laptop over Tailscale, label and meal routes, review screen, offline queue.
5. Progress: charts for lifts, nutrition, mood; CSV export.
6. Real install: GitHub Actions macOS build of the .ipa, install with SideStore, confirm it works alongside Tailscale.

## How I want you to work
- Before coding, show me the folder structure and the full schema, then wait for my OK.
- Create all tables up front, but only build Phase 1 screens now.
- Build one feature at a time and tell me exactly how to test it in Expo Go on my iPhone.
- Keep the UI clean, fast, and dark-mode friendly.
- Keep a README with setup steps and a CHANGELOG as you go.
- When a phase is done, tell me and wait before starting the next one.
