import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import {
  addMessage,
  getGoals,
  goalsText,
  listMessages,
  listUnanswered,
  setMessageStatus,
  type CoachMessage,
  type PlanProposal,
} from '@/db/repos/coach';
import { listExercises } from '@/db/repos/exercises';
import { addExercisesToRoutine, createRoutine, listRoutineExercises, updateTargets } from '@/db/repos/routines';
import { addScheduled } from '@/db/repos/schedule';
import { buildCoachContext } from '@/lib/coachContext';
import { syncWorkoutReminders } from '@/lib/notifications';
import { serverPost } from '@/lib/snapshotClient';

/**
 * Sends one user message to the laptop and stores the reply. Returns 'unreachable' when the
 * laptop is offline (the message stays queued and is retried with the snapshot queue).
 */
export async function answerMessage(db: SQLiteDatabase, msg: CoachMessage, notify: boolean): Promise<'ok' | 'unreachable' | 'failed'> {
  await setMessageStatus(db, msg.id, 'sending');
  const context = await buildCoachContext(db);

  let result: { ok: true; text: string; payload?: PlanProposal; kind: 'chat' | 'plan' } | { ok: false; unreachable: boolean; error: string };
  if (msg.kind === 'plan') {
    const exercises = (await listExercises(db)).map((e) => e.name);
    const goals = `${goalsText(await getGoals(db))}\nRequest: ${msg.text}`;
    const r = await serverPost<PlanProposal>(db, '/plan', { goals, context, exercises }, 300_000);
    result = r.ok
      ? r.data.routines.length
        ? { ok: true, kind: 'plan', text: r.data.summary || 'Here’s a plan.', payload: r.data }
        : { ok: true, kind: 'chat', text: 'I couldn’t build a plan from your exercise library. Try describing what you want differently.' }
      : r;
  } else {
    const history = (await listMessages(db, 30))
      .filter((m) => m.status === 'done' && m.id < msg.id)
      .slice(-16)
      .map((m) => ({ role: m.role, content: m.text }));
    const r = await serverPost<{ reply: string }>(db, '/chat', { messages: [...history, { role: 'user', content: msg.text }], context });
    result = r.ok ? { ok: true, kind: 'chat', text: r.data.reply } : r;
  }

  if (!result.ok) {
    await setMessageStatus(db, msg.id, result.unreachable ? 'queued' : 'error', result.unreachable ? null : result.error);
    return result.unreachable ? 'unreachable' : 'failed';
  }
  await addMessage(db, { role: 'assistant', kind: result.kind, text: result.text, payload: result.payload });
  await setMessageStatus(db, msg.id, 'done');
  if (notify) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Coach replied', body: result.text.slice(0, 120), data: { url: '/coach' } },
      trigger: null,
    }).catch(() => {});
  }
  return 'ok';
}

/** Answers queued questions (called with the snapshot queue: launch, foreground, every 2 min). */
export async function processCoachQueue(db: SQLiteDatabase) {
  for (const m of await listUnanswered(db)) {
    if ((await answerMessage(db, m, true)) === 'unreachable') return;
  }
}

/** Creates the plan's routines and puts them on the weekly schedule (existing routines are kept). */
export async function applyPlan(db: SQLiteDatabase, plan: PlanProposal) {
  const byName = new Map((await listExercises(db)).map((e) => [e.name.toLowerCase(), e.id]));
  for (const r of plan.routines) {
    const routineId = await createRoutine(db, r.name);
    const ids = r.exercises.map((e) => byName.get(e.name.toLowerCase())).filter((x): x is number => !!x);
    await addExercisesToRoutine(db, routineId, ids);
    const rows = await listRoutineExercises(db, routineId);
    for (const row of rows) {
      const spec = r.exercises.find((e) => byName.get(e.name.toLowerCase()) === row.exercise_id);
      if (spec) await updateTargets(db, row.id, spec.sets, spec.reps);
    }
    await addScheduled(db, routineId, { weekday: r.weekday }, null);
  }
  await syncWorkoutReminders(db);
}
