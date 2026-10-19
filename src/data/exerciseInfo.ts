import type { Slug } from 'react-native-body-highlighter';

// Library content for the calendar-imported exercises (migration 007 fills it in only where
// the user hasn't already written notes / picked a video / set equipment).
// Videos: popular short (< 4 min) embeddable YouTube tutorials, picked 2026-10-19.

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Band', 'Landmine', 'Other'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type ExerciseInfo = {
  equipment: Equipment;
  primary: Slug[];
  secondary: Slug[];
  video: string; // YouTube id
  how: string;
};

export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  // ── Back & Shoulder ──
  'Dumbbell Lateral Raise': {
    equipment: 'Dumbbell',
    primary: ['deltoids'],
    secondary: ['trapezius'],
    video: '3VcKaXpzqRo',
    how: `Stand tall, dumbbells at your sides, slight bend in the elbows.
1. Raise the weights out to the sides until your arms are about shoulder height.
2. Lead with the elbows, pinkies slightly up, as if pouring water.
3. Lower slowly over 2–3 seconds.
Cues: shoulders down away from the ears; no swinging. Feel the side of the shoulder, not the traps.`,
  },
  'Dumbbell Shoulder Raise': {
    equipment: 'Dumbbell',
    primary: ['deltoids'],
    secondary: ['chest', 'trapezius'],
    video: '-t7fuZ0KhDA',
    how: `(Set up as a front raise. Edit if you meant a shoulder press.)
Stand tall, dumbbells in front of your thighs, palms facing you.
1. Raise the weights straight in front to shoulder height, elbows slightly bent.
2. Pause briefly, then lower under control.
Cues: brace your core, no leaning back. Feel the front of the shoulder.`,
  },
  'Barbell Deadlift': {
    equipment: 'Barbell',
    primary: ['hamstring', 'gluteal', 'lower-back'],
    secondary: ['quadriceps', 'trapezius', 'upper-back', 'forearm'],
    video: '-4qRntuXBSc',
    how: `Feet hip-width, bar over mid-foot, about 1 inch from the shins.
1. Hinge down and grip just outside the legs. Shins touch the bar.
2. Chest up, flat back, pull the slack out of the bar ("bend the bar around your legs").
3. Push the floor away; bar travels straight up, close to the legs.
4. Lock out by squeezing the glutes. Don't lean back.
5. Lower by pushing the hips back first, then bend the knees once the bar passes them.
Cues: lats tight, neutral neck, brace before every rep.`,
  },
  'Dumbbell Bent-Over Row': {
    equipment: 'Dumbbell',
    primary: ['upper-back'],
    secondary: ['biceps', 'deltoids', 'lower-back', 'forearm'],
    video: '6TSP1TRMUzs',
    how: `Hinge forward to about 45°, flat back, dumbbells hanging under the shoulders.
1. Row the weights toward your hips, elbows close to the body.
2. Squeeze the shoulder blades together at the top.
3. Lower until the arms are straight and feel the lats stretch.
Cues: pull with the elbows, not the hands. Keep the torso still.`,
  },
  Rowing: {
    equipment: 'Machine',
    primary: ['upper-back'],
    secondary: ['biceps', 'deltoids', 'trapezius'],
    video: 'GZbfZ033f74',
    how: `(Set up as a seated cable/machine row. Edit if you meant something else.)
Sit tall, feet braced, slight bend in the knees, arms straight.
1. Pull the handle to your lower ribs, driving the elbows back.
2. Squeeze the shoulder blades together and pause.
3. Let the arms extend fully and the shoulders reach forward for a stretch.
Cues: chest up, don't rock your torso. Think "elbows to back pockets".`,
  },
  'Cable Lat Pulldown': {
    equipment: 'Cable',
    primary: ['upper-back'],
    secondary: ['biceps', 'forearm', 'deltoids'],
    video: 'trZQjegcRx0',
    how: `Grip slightly wider than shoulders, thighs locked under the pad.
1. Lean back slightly and pull the bar to your upper chest.
2. Drive the elbows down and in toward your sides.
3. Return slowly until the arms are straight and the lats stretch.
Cues: shoulders down first, then pull. Don't yank with your body.`,
  },
  'Cable Lat Pulldown (Underhand)': {
    equipment: 'Cable',
    primary: ['upper-back', 'biceps'],
    secondary: ['forearm'],
    video: 'VprlTxpB1rk',
    how: `Palms facing you, hands about shoulder-width.
1. Pull the bar to your upper chest, elbows driving down by your sides.
2. Squeeze at the bottom.
3. Control it back up to a full stretch.
Cues: the underhand grip brings in more biceps. Keep the chest up and the torso quiet.`,
  },
  'Face Pull': {
    equipment: 'Cable',
    primary: ['deltoids', 'trapezius'],
    secondary: ['upper-back'],
    video: 'rep-qVOkqgk',
    how: `Rope attachment at upper-chest to head height.
1. Pull the rope toward your face, splitting the ends apart.
2. Finish with the elbows high and the hands beside your ears ("double biceps" pose).
3. Return slowly.
Cues: light weight, pause at the end. Feel the rear delts and upper back.`,
  },
  'Barbell Rear Delt Raise': {
    equipment: 'Barbell',
    primary: ['deltoids', 'upper-back'],
    secondary: ['trapezius', 'biceps'],
    video: 'XagV4XfG9fo',
    how: `(Set up as a barbell rear delt row.)
Wide grip, hinge forward until the torso is close to parallel.
1. Row the bar to your upper chest with the elbows flared out wide.
2. Squeeze the back of the shoulders at the top.
3. Lower under control.
Cues: elbows out at about 90° to the torso; light weight, no momentum.`,
  },
  'Barbell Seal Row': {
    equipment: 'Barbell',
    primary: ['upper-back'],
    secondary: ['biceps', 'deltoids'],
    video: 'UzOhDqu-5Tw',
    how: `Lie face down on a raised flat bench, bar hanging below.
1. Row the bar up to the underside of the bench.
2. Squeeze the shoulder blades together.
3. Lower to a full stretch.
Cues: the chest stays on the bench, so all the work is back. No cheating possible.`,
  },
  Hyperextension: {
    equipment: 'Bodyweight',
    primary: ['lower-back', 'gluteal'],
    secondary: ['hamstring'],
    video: 'ph3pddpKzzw',
    how: `Hip pad just below the hip bones, ankles locked in.
1. Lower your torso by hinging at the hips.
2. Raise back up until your body forms a straight line.
Cues: don't over-arch at the top. Squeeze the glutes to finish. Hold a plate to make it harder.`,
  },
  'Landmine Row': {
    equipment: 'Landmine',
    primary: ['upper-back'],
    secondary: ['biceps', 'lower-back', 'trapezius'],
    video: '9hSQVBHLOX0',
    how: `Straddle the bar (or stand beside it for one arm), hinge forward with a flat back.
1. Row the end of the bar to your chest or stomach.
2. Squeeze the back at the top.
3. Lower to a full stretch.
Cues: keep the hips back and the chest proud. Use a V-handle under the bar for a T-bar row.`,
  },
  'Shrug (Dumbbell)': {
    equipment: 'Dumbbell',
    primary: ['trapezius'],
    secondary: ['forearm'],
    video: 'cJRVVxmytaM',
    how: `Stand tall, dumbbells at your sides.
1. Lift your shoulders straight up toward your ears.
2. Hold 1–2 seconds at the top.
3. Lower all the way down.
Cues: straight up and down. Don't roll the shoulders. Arms stay straight.`,
  },
  'Shrug (Barbell)': {
    equipment: 'Barbell',
    primary: ['trapezius'],
    secondary: ['forearm'],
    video: 'NAqCVe2mwzM',
    how: `Hold the bar at shoulder width in front of your thighs.
1. Shrug the shoulders straight up as high as possible.
2. Pause at the top, then lower fully.
Cues: no rolling, no bouncing. Straps help if grip gives out first.`,
  },
  'Shrug (Cable)': {
    equipment: 'Cable',
    primary: ['trapezius'],
    secondary: ['forearm'],
    video: 'Wab3-dsZohU',
    how: `Low pulley with a bar or handles, stand close.
1. Shrug straight up and hold briefly.
2. Lower slowly. The cable keeps tension the whole way.
Cues: tall posture, arms straight.`,
  },

  // ── Upper Body ──
  'Bench Press (Machine)': {
    equipment: 'Machine',
    primary: ['chest'],
    secondary: ['triceps', 'deltoids'],
    video: 'xUm0BiZCWlQ',
    how: `Set the seat so the handles line up with mid-chest.
1. Shoulder blades back and down against the pad.
2. Press the handles forward until the arms are almost straight.
3. Return slowly until you feel a chest stretch.
Cues: don't let the shoulders roll forward at the top.`,
  },
  'Bench Press (Barbell)': {
    equipment: 'Barbell',
    primary: ['chest'],
    secondary: ['triceps', 'deltoids'],
    video: 'gRVjAtPip0Y',
    how: `Eyes under the bar, feet flat, shoulder blades squeezed back and down, slight arch.
1. Grip slightly wider than shoulders and unrack with straight arms.
2. Lower the bar to mid or lower chest, elbows about 45° from the body.
3. Touch lightly and press up and slightly back over the shoulders.
Cues: drive the feet into the floor, keep the wrists stacked over the elbows. Use a spotter or safeties.`,
  },
  'Incline Bench Press (Machine)': {
    equipment: 'Machine',
    primary: ['chest', 'deltoids'],
    secondary: ['triceps'],
    video: 'ig0NyNlSce4',
    how: `Seat set so the handles start around upper-chest height.
1. Shoulder blades pinned back.
2. Press up and forward until the arms are almost straight.
3. Lower slowly to a deep upper-chest stretch.
Cues: think "elbows toward each other" as you press.`,
  },
  'Incline Bench Press (Barbell)': {
    equipment: 'Barbell',
    primary: ['chest', 'deltoids'],
    secondary: ['triceps'],
    video: 'DbFgADa2PL8',
    how: `Bench at 30–45°, shoulder blades back and down.
1. Unrack and lower the bar to your upper chest, just below the collarbone.
2. Press straight up over the shoulders.
Cues: elbows slightly tucked; don't flare. Keep the upper back tight on the bench.`,
  },
  'Fly (Machine)': {
    equipment: 'Machine',
    primary: ['chest'],
    secondary: ['deltoids'],
    video: 'Z57CtFmRMxA',
    how: `Pec deck: handles at chest height, slight bend in the elbows.
1. Bring the handles together in a wide arc in front of your chest.
2. Squeeze the chest for a second.
3. Open slowly until you feel a stretch, without going past comfortable.
Cues: chest up, shoulders back. Hug a big tree.`,
  },
  'Fly (Dumbbell)': {
    equipment: 'Dumbbell',
    primary: ['chest'],
    secondary: ['deltoids'],
    video: 'eozdVDA78K0',
    how: `Lie on a flat bench, dumbbells above the chest, palms facing each other.
1. With a fixed slight elbow bend, lower the weights out to the sides in an arc.
2. Stop at a deep chest stretch, around chest level.
3. Bring them back up along the same arc.
Cues: it's a hug, not a press. Go light.`,
  },
  'Cable Standing Fly': {
    equipment: 'Cable',
    primary: ['chest'],
    secondary: ['deltoids'],
    video: 'taI4XduLpTk',
    how: `Pulleys at shoulder height or higher, one handle in each hand, step forward in a split stance.
1. Slight elbow bend; bring the hands together in front of your chest (or slightly below).
2. Squeeze, then let the arms open slowly to a stretch.
Cues: high-to-low pulleys hit the lower chest; low-to-high hits the upper chest.`,
  },
  'Incline Push-up': {
    equipment: 'Bodyweight',
    primary: ['chest'],
    secondary: ['triceps', 'deltoids', 'abs'],
    video: 'Z0bRiVhnO8Q',
    how: `Hands on a bench or bar, slightly wider than shoulders; body in a straight line.
1. Lower your chest to the edge.
2. Push back up to straight arms.
Cues: squeeze the glutes and abs so the hips don't sag. A higher surface makes it easier.`,
  },
  'Dumbbell Curl': {
    equipment: 'Dumbbell',
    primary: ['biceps'],
    secondary: ['forearm'],
    video: 'ykJmrZ5v0Oo',
    how: `Stand tall, dumbbells at your sides, palms forward.
1. Curl the weights up while keeping the elbows pinned at your sides.
2. Squeeze at the top.
3. Lower slowly all the way down.
Cues: no swinging; the elbows don't drift forward.`,
  },
  'Preacher Curl (Standing)': {
    equipment: 'Barbell',
    primary: ['biceps'],
    secondary: ['forearm'],
    video: 'Gydpcouclx8',
    how: `Armpits snug over the top of the preacher pad, EZ-bar in an underhand grip.
1. Curl the bar up without lifting the elbows off the pad.
2. Lower slowly until the arms are almost straight.
Cues: control the bottom; don't drop into a locked elbow.`,
  },
  'Preacher Curl (Sitting)': {
    equipment: 'Machine',
    primary: ['biceps'],
    secondary: ['forearm'],
    video: 'Ja6ZlIDONac',
    how: `Seat set so your armpits sit at the top of the pad, elbows lined up with the machine's pivot.
1. Curl the handles up and squeeze.
2. Lower slowly to a full stretch.
Cues: the elbows stay on the pad, wrists neutral.`,
  },
  'Cable Curl': {
    equipment: 'Cable',
    primary: ['biceps'],
    secondary: ['forearm'],
    video: 'NFzTWp2qpiE',
    how: `Low pulley with a straight or EZ bar, stand close.
1. Curl up with the elbows at your sides.
2. Squeeze and lower under control.
Cues: the cable keeps tension at the top, so pause there.`,
  },
  'Machine Curl': {
    equipment: 'Machine',
    primary: ['biceps'],
    secondary: ['forearm'],
    video: 'M_uPvGrMx_o',
    how: `Line your elbows up with the machine's pivot.
1. Curl up, squeeze for a second.
2. Lower slowly.
Cues: don't let the shoulders roll forward or the hips lift.`,
  },
  'Lying Triceps Extension': {
    equipment: 'Barbell',
    primary: ['triceps'],
    secondary: [],
    video: 'd_KZxkY_0cM',
    how: `Skull crusher: lie on a bench with an EZ-bar over your chest, arms straight.
1. Keeping the upper arms still, bend the elbows to lower the bar toward your forehead or just behind your head.
2. Extend back up by squeezing the triceps.
Cues: elbows point at the ceiling and don't flare out. Start light.`,
  },
  'Triceps Dip': {
    equipment: 'Bodyweight',
    primary: ['triceps'],
    secondary: ['chest', 'deltoids'],
    video: '6kALZikXxLc',
    how: `On parallel bars (or a bench), arms straight, body upright.
1. Lower by bending the elbows until they reach about 90°.
2. Press back up to straight arms.
Cues: stay upright for triceps (leaning forward shifts it to the chest). Shoulders down, not shrugging.`,
  },
  'Wrist Curl (Cable)': {
    equipment: 'Cable',
    primary: ['forearm'],
    secondary: [],
    video: 'WVAaKJvToe0',
    how: `Kneel or sit facing a low pulley, forearms resting on your thighs or a bench, palms up.
1. Let the handle roll down to your fingertips.
2. Curl the wrists up as high as possible.
Cues: small, controlled movement with high reps (12–20).`,
  },
  'Wrist Curl (Barbell)': {
    equipment: 'Barbell',
    primary: ['forearm'],
    secondary: [],
    video: 'qMtmHwaCmYI',
    how: `Sit with your forearms on your thighs, wrists just past the knees, palms up, holding the bar.
1. Lower the bar by opening the hands slightly.
2. Curl the wrists up and squeeze.
Cues: only the wrists move. Go light, high reps.`,
  },

  // ── Legs & Abs ──
  'Calf Raise (Machine)': {
    equipment: 'Machine',
    primary: ['calves'],
    secondary: [],
    video: 'CtyIVeJH6lI',
    how: `Balls of the feet on the edge of the platform, heels free.
1. Lower the heels as far as you can for a deep stretch, and pause.
2. Rise up onto your toes as high as possible, and pause.
Cues: slow, full range. No bouncing. Knees straight but not locked.`,
  },
  'Calf Raise (Barbell)': {
    equipment: 'Barbell',
    primary: ['calves'],
    secondary: [],
    video: '3UWi44yN-wM',
    how: `Bar on your upper back as for a squat; balls of the feet on a plate or step for extra range.
1. Rise onto your toes and squeeze.
2. Lower slowly into a stretch.
Cues: stay tall and balanced; use a rack or Smith machine if balance is the limit.`,
  },
  'Barbell Rear Lunge': {
    equipment: 'Barbell',
    primary: ['quadriceps', 'gluteal'],
    secondary: ['hamstring', 'adductors', 'calves'],
    video: 'xrPteyQLGAo',
    how: `Reverse lunge: bar on your upper back, feet hip-width.
1. Step one foot back and lower until the back knee nearly touches the floor.
2. Drive through the front heel to return to standing.
3. Alternate legs, or do all reps on one side.
Cues: torso upright, front knee tracks over the toes. Leaning slightly forward hits the glutes more.`,
  },
  'RDL (Dumbbell)': {
    equipment: 'Dumbbell',
    primary: ['hamstring', 'gluteal'],
    secondary: ['lower-back', 'forearm'],
    video: 'hQgFixeXdZo',
    how: `Romanian deadlift: stand with dumbbells in front of your thighs, soft knees.
1. Push the hips back, sliding the weights down the front of your legs.
2. Stop when you feel a strong hamstring stretch (usually mid-shin).
3. Drive the hips forward to stand, squeezing the glutes.
Cues: flat back, weights close to the legs; the knees barely move.`,
  },
  'RDL (Resistance Band)': {
    equipment: 'Band',
    primary: ['hamstring', 'gluteal'],
    secondary: ['lower-back'],
    video: 'NaKsZos0bIY',
    how: `Stand on the band, hip-width, holding the ends (or a handle) in front of you.
1. Hinge at the hips with soft knees until you feel a hamstring stretch.
2. Drive the hips forward to stand tall and squeeze the glutes hard at the top. That's where the band is hardest.
Cues: flat back. Good as a warm-up or home finisher.`,
  },
  'Machine Seated Leg Curl': {
    equipment: 'Machine',
    primary: ['hamstring'],
    secondary: ['calves'],
    video: 'ELOCsoDSmrg',
    how: `Knees lined up with the machine's pivot, lap pad snug on the thighs.
1. Curl your heels down and back as far as possible.
2. Squeeze, then return slowly to a full stretch.
Cues: lean the torso forward slightly for a bigger hamstring stretch. Don't let the hips lift.`,
  },
  'Leg Press': {
    equipment: 'Machine',
    primary: ['quadriceps', 'gluteal'],
    secondary: ['hamstring', 'adductors'],
    video: 'IZxyjW7MPJQ',
    how: `Feet shoulder-width, mid-platform; back and hips flat on the pad.
1. Release the safeties and lower the sled until the knees reach about 90° or deeper.
2. Press through the whole foot back up.
Cues: don't lock the knees at the top, and don't let the lower back peel off the pad at the bottom. Feet higher means more glutes and hamstrings; lower means more quads.`,
  },
};
