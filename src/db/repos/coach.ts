import type { SQLiteDatabase } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/repos/settings';

export type CoachMessage = {
  id: number;
  role: 'user' | 'assistant';
  kind: 'chat' | 'plan';
  text: string;
  payload: string | null; // JSON plan proposal on assistant 'plan' messages
  status: 'queued' | 'sending' | 'done' | 'error';
  error: string | null;
  created_at: string;
};

export type PlanProposal = {
  summary: string;
  routines: { name: string; weekday: number; exercises: { name: string; sets: number; reps: number }[] }[];
};

export function listMessages(db: SQLiteDatabase, limit = 200) {
  return db.getAllAsync<CoachMessage>('SELECT * FROM (SELECT * FROM coach_message ORDER BY id DESC LIMIT ?) ORDER BY id', limit);
}

export async function addMessage(
  db: SQLiteDatabase,
  m: { role: 'user' | 'assistant'; kind?: 'chat' | 'plan'; text: string; payload?: unknown; status?: CoachMessage['status'] },
) {
  return (
    await db.runAsync(
      'INSERT INTO coach_message (role, kind, text, payload, status) VALUES (?, ?, ?, ?, ?)',
      m.role,
      m.kind ?? 'chat',
      m.text,
      m.payload === undefined ? null : JSON.stringify(m.payload),
      m.status ?? 'done',
    )
  ).lastInsertRowId;
}

export async function setMessageStatus(db: SQLiteDatabase, id: number, status: CoachMessage['status'], error: string | null = null) {
  await db.runAsync('UPDATE coach_message SET status = ?, error = ? WHERE id = ?', status, error, id);
}

/** User messages still waiting for an answer ('sending' left over from a closed app is retried). */
export function listUnanswered(db: SQLiteDatabase) {
  return db.getAllAsync<CoachMessage>("SELECT * FROM coach_message WHERE role = 'user' AND status IN ('queued','sending') ORDER BY id");
}

export async function clearChat(db: SQLiteDatabase) {
  await db.runAsync('DELETE FROM coach_message');
}

// ── Goals (from the coach's onboarding) ──
export type Goals = {
  goal: string; // e.g. "Build muscle"
  experience: string; // Beginner / Intermediate / Advanced
  daysPerWeek: number;
  minutes: number; // per session
  notes: string; // injuries, equipment, likes/dislikes
};

export async function getGoals(db: SQLiteDatabase): Promise<Goals | null> {
  const v = await getSetting(db, 'coach_goals');
  return v ? (JSON.parse(v) as Goals) : null;
}

export async function saveGoals(db: SQLiteDatabase, g: Goals) {
  await setSetting(db, 'coach_goals', JSON.stringify(g));
}

export function goalsText(g: Goals | null) {
  if (!g) return 'No goals set yet.';
  return `Goal: ${g.goal}. Experience: ${g.experience}. Can train ${g.daysPerWeek} days/week, about ${g.minutes} min per session.${
    g.notes.trim() ? ` Notes: ${g.notes.trim()}` : ''
  }`;
}
