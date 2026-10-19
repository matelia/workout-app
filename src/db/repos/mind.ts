import type { SQLiteDatabase } from 'expo-sqlite';

// Mind data never leaves the phone except via the user-initiated "Export for therapist".

// ── Check-ins ──
export type CheckIn = {
  id: number;
  date: string;
  mood: number | null;
  energy: number | null;
  sleep_hours: number | null;
  tags: string | null; // JSON array
  note: string | null;
  photo_path: string | null; // relative to documents
  audio_path: string | null; // relative to documents
  logged_at: string | null;
};

export function getCheckIn(db: SQLiteDatabase, date: string) {
  return db.getFirstAsync<CheckIn>('SELECT * FROM mood_checkin WHERE date = ? ORDER BY id DESC LIMIT 1', date);
}

export function listCheckIns(db: SQLiteDatabase, from: string, to: string) {
  return db.getAllAsync<CheckIn>('SELECT * FROM mood_checkin WHERE date BETWEEN ? AND ? ORDER BY date', from, to);
}

/** One check-in per day: saving again on the same day overwrites it. */
export async function saveCheckIn(db: SQLiteDatabase, c: Omit<CheckIn, 'id'>) {
  const existing = await getCheckIn(db, c.date);
  if (existing) {
    await db.runAsync(
      'UPDATE mood_checkin SET mood = ?, energy = ?, sleep_hours = ?, tags = ?, note = ?, photo_path = ?, audio_path = ?, logged_at = ? WHERE id = ?',
      c.mood, c.energy, c.sleep_hours, c.tags, c.note, c.photo_path, c.audio_path, c.logged_at, existing.id,
    );
  } else {
    await db.runAsync(
      'INSERT INTO mood_checkin (date, mood, energy, sleep_hours, tags, note, photo_path, audio_path, logged_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      c.date, c.mood, c.energy, c.sleep_hours, c.tags, c.note, c.photo_path, c.audio_path, c.logged_at,
    );
  }
}

// ── Journal ──
export type JournalEntry = { id: number; datetime: string; text: string; bring_to_therapy: number };

export function listJournal(db: SQLiteDatabase) {
  return db.getAllAsync<JournalEntry>('SELECT * FROM journal_entry ORDER BY datetime DESC');
}

export function getJournal(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<JournalEntry>('SELECT * FROM journal_entry WHERE id = ?', id);
}

export function listFlaggedSince(db: SQLiteDatabase, since: string | null) {
  return db.getAllAsync<JournalEntry>(
    'SELECT * FROM journal_entry WHERE bring_to_therapy = 1 AND datetime >= ? ORDER BY datetime',
    since ?? '0000',
  );
}

export function listJournalBetween(db: SQLiteDatabase, from: string, to: string, flaggedOnly: boolean) {
  return db.getAllAsync<JournalEntry>(
    `SELECT * FROM journal_entry WHERE substr(datetime, 1, 10) BETWEEN ? AND ?
     ${flaggedOnly ? 'AND bring_to_therapy = 1' : ''} ORDER BY datetime`,
    from,
    to,
  );
}

export async function saveJournal(db: SQLiteDatabase, id: number | null, e: Omit<JournalEntry, 'id'>) {
  if (id) {
    await db.runAsync(
      'UPDATE journal_entry SET datetime = ?, text = ?, bring_to_therapy = ? WHERE id = ?',
      e.datetime, e.text, e.bring_to_therapy, id,
    );
    return id;
  }
  return (
    await db.runAsync(
      'INSERT INTO journal_entry (datetime, text, bring_to_therapy) VALUES (?, ?, ?)',
      e.datetime, e.text, e.bring_to_therapy,
    )
  ).lastInsertRowId;
}

export async function deleteJournal(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM journal_entry WHERE id = ?', id);
}

// ── Therapy sessions ──
export type TherapySession = {
  id: number;
  date: string;
  notes: string | null;
  takeaways: string | null;
  homework: string | null;
};

export function listTherapy(db: SQLiteDatabase) {
  return db.getAllAsync<TherapySession>('SELECT * FROM therapy_session ORDER BY date DESC, id DESC');
}

export function getTherapy(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<TherapySession>('SELECT * FROM therapy_session WHERE id = ?', id);
}

export function lastTherapyBefore(db: SQLiteDatabase, date: string) {
  return db.getFirstAsync<TherapySession>(
    'SELECT * FROM therapy_session WHERE date <= ? ORDER BY date DESC, id DESC LIMIT 1',
    date,
  );
}

export function listTherapyBetween(db: SQLiteDatabase, from: string, to: string) {
  return db.getAllAsync<TherapySession>(
    'SELECT * FROM therapy_session WHERE date BETWEEN ? AND ? ORDER BY date',
    from,
    to,
  );
}

export async function saveTherapy(db: SQLiteDatabase, id: number | null, t: Omit<TherapySession, 'id'>) {
  if (id) {
    await db.runAsync(
      'UPDATE therapy_session SET date = ?, notes = ?, takeaways = ?, homework = ? WHERE id = ?',
      t.date, t.notes, t.takeaways, t.homework, id,
    );
    return id;
  }
  return (
    await db.runAsync(
      'INSERT INTO therapy_session (date, notes, takeaways, homework) VALUES (?, ?, ?, ?)',
      t.date, t.notes, t.takeaways, t.homework,
    )
  ).lastInsertRowId;
}

export async function deleteTherapy(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM therapy_session WHERE id = ?', id);
}
