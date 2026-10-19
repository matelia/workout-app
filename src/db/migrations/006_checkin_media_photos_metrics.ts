import type { SQLiteDatabase } from 'expo-sqlite';

// - Check-ins get a photo, a voice memo and a time.
// - Progress (body) photos.
// - Body metrics from Apple Health / Renpho / manual weigh-ins, one row per measurement time.
//   Existing body_weight_log rows are copied in; body_weight_log is no longer written to.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE mood_checkin ADD COLUMN photo_path TEXT;
    ALTER TABLE mood_checkin ADD COLUMN audio_path TEXT;
    ALTER TABLE mood_checkin ADD COLUMN logged_at TEXT;

    CREATE TABLE progress_photo (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      pose TEXT NOT NULL CHECK (pose IN ('front','side','back','other')),
      photo_path TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_progress_photo_date ON progress_photo(date);

    CREATE TABLE body_metric (
      id INTEGER PRIMARY KEY,
      measured_at TEXT NOT NULL UNIQUE,   -- local 'YYYY-MM-DDTHH:MM'
      date TEXT NOT NULL,
      source TEXT NOT NULL,               -- 'health' | 'renpho' | 'manual'
      weight_lb REAL,
      body_fat_pct REAL,
      lean_mass_lb REAL,
      muscle_mass_lb REAL,
      skeletal_muscle_pct REAL,
      bmi REAL,
      visceral_fat REAL,
      body_water_pct REAL,
      bone_mass_lb REAL,
      bmr_kcal REAL,
      metabolic_age REAL
    );
    CREATE INDEX idx_body_metric_date ON body_metric(date);

    INSERT OR IGNORE INTO body_metric (measured_at, date, source, weight_lb)
      SELECT date || 'T12:00', date, 'manual', weight_lb FROM body_weight_log;
  `);
}
