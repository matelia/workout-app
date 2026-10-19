import type { SQLiteDatabase } from 'expo-sqlite';

// Creates every table for all phases up front (see SPEC.md "Data model").
// Conventions: dates 'YYYY-MM-DD', times 'HH:MM', datetimes ISO 8601, booleans 0/1, lists as JSON text.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    -- Workouts / Library
    CREATE TABLE exercise (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      muscle_group TEXT,
      notes TEXT,
      video_type TEXT CHECK (video_type IN ('youtube','instagram','file')),
      video_url_or_path TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE routine (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE routine_exercise (
      id INTEGER PRIMARY KEY,
      routine_id INTEGER NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercise(id),
      sort_order INTEGER NOT NULL,
      target_sets INTEGER NOT NULL DEFAULT 3,
      target_reps INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE scheduled_workout (
      id INTEGER PRIMARY KEY,
      routine_id INTEGER NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
      weekday INTEGER CHECK (weekday BETWEEN 0 AND 6),
      date TEXT,
      reminder_time TEXT,
      notification_id TEXT,
      CHECK ((weekday IS NULL) <> (date IS NULL))
    );

    CREATE TABLE workout_session (
      id INTEGER PRIMARY KEY,
      routine_id INTEGER REFERENCES routine(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT
    );

    CREATE TABLE set_log (
      id INTEGER PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercise(id),
      set_number INTEGER NOT NULL,
      reps INTEGER,
      weight_lb REAL,
      done INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );
    CREATE INDEX idx_set_log_exercise ON set_log(exercise_id, session_id);

    -- Mind (Phase 2)
    CREATE TABLE mood_checkin (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      mood INTEGER CHECK (mood BETWEEN 1 AND 5),
      energy INTEGER CHECK (energy BETWEEN 1 AND 5),
      sleep_hours REAL,
      tags TEXT,
      note TEXT
    );

    CREATE TABLE journal_entry (
      id INTEGER PRIMARY KEY,
      datetime TEXT NOT NULL,
      text TEXT NOT NULL,
      bring_to_therapy INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE therapy_session (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      notes TEXT,
      takeaways TEXT,
      homework TEXT
    );

    CREATE TABLE care_item (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('meds','skin','hair','other')),
      schedule_times TEXT NOT NULL,
      weekdays TEXT,
      notification_label TEXT NOT NULL,
      notification_ids TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE care_log (
      id INTEGER PRIMARY KEY,
      care_item_id INTEGER NOT NULL REFERENCES care_item(id) ON DELETE CASCADE,
      scheduled_time TEXT NOT NULL,
      done_time TEXT,
      skipped INTEGER NOT NULL DEFAULT 0
    );

    -- Food (Phases 3-4)
    CREATE TABLE food (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('usda','off','manual')),
      barcode TEXT,
      kcal_100g REAL,
      protein_100g REAL,
      carbs_100g REAL,
      fat_100g REAL
    );
    CREATE INDEX idx_food_barcode ON food(barcode);

    CREATE TABLE saved_meal (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      servings_per_batch REAL NOT NULL DEFAULT 1
    );

    CREATE TABLE saved_meal_item (
      id INTEGER PRIMARY KEY,
      saved_meal_id INTEGER NOT NULL REFERENCES saved_meal(id) ON DELETE CASCADE,
      food_id INTEGER NOT NULL REFERENCES food(id),
      grams REAL NOT NULL
    );

    CREATE TABLE food_log (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
      food_id INTEGER REFERENCES food(id),
      saved_meal_id INTEGER REFERENCES saved_meal(id),
      grams REAL,
      servings REAL,
      photo_path TEXT,
      CHECK ((food_id IS NULL) <> (saved_meal_id IS NULL))
    );

    CREATE TABLE snapshot_job (
      id INTEGER PRIMARY KEY,
      photo_path TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('label','meal')),
      status TEXT NOT NULL CHECK (status IN ('queued','processing','needs_review','done')),
      model_output_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE targets (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      kcal REAL,
      protein_g REAL,
      carbs_g REAL,
      fat_g REAL
    );

    -- Progress / misc
    CREATE TABLE body_weight_log (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      weight_lb REAL NOT NULL
    );

    CREATE TABLE setting (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}
