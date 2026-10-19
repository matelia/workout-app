import type { SQLiteDatabase } from 'expo-sqlite';

// Fiber, sugar, saturated fat and sodium on foods, plus daily goal/limits.
// Defaults follow the US Dietary Guidelines: fiber ≥ 30 g, sugar ≤ 50 g (≈10% of 2,000 kcal;
// we only know total sugar), saturated fat ≤ 22 g (≈10% of 2,000 kcal), sodium ≤ 2,300 mg.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE food ADD COLUMN fiber_100g REAL;
    ALTER TABLE food ADD COLUMN sugar_100g REAL;
    ALTER TABLE food ADD COLUMN sat_fat_100g REAL;
    ALTER TABLE food ADD COLUMN sodium_mg_100g REAL;

    ALTER TABLE targets ADD COLUMN fiber_g REAL;
    ALTER TABLE targets ADD COLUMN sugar_g REAL;
    ALTER TABLE targets ADD COLUMN sat_fat_g REAL;
    ALTER TABLE targets ADD COLUMN sodium_mg REAL;

    INSERT OR IGNORE INTO targets (id) VALUES (1);
    UPDATE targets SET fiber_g = 30, sugar_g = 50, sat_fat_g = 22, sodium_mg = 2300 WHERE id = 1;
  `);
}
