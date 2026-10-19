// Generates the three Today-screen design mockups as HTML (rendered to PNG with headless Chrome).
// Usage: node design/make-mockups.mjs  -> design/mockup-{a,b,c}.html
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const themes = {
  a: {
    name: 'Upkeep',
    fonts: 'family=Inter:wght@400;500;600;700',
    body: 'Inter',
    display: 'Inter',
    bg: '#0B0B0F', card: '#1C1C22', card2: '#26262E', text: '#F2F2F5', muted: '#8E8E99',
    accent: '#19B890', onAccent: '#04281F', accent2: '#8CC63F', warn: '#F28C22',
    radius: 20, greet: 'Good morning, Matin', titleSize: 30, titleWeight: 700, tabActive: '#19B890',
  },
  b: {
    name: 'Steady',
    fonts: 'family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800',
    body: 'Inter',
    display: 'Barlow Condensed',
    bg: '#0E0E0E', card: '#1B1B1B', card2: '#262626', text: '#FFFFFF', muted: '#9A9A9A',
    accent: '#C6F432', onAccent: '#111111', accent2: '#FF5A36', warn: '#FF5A36',
    radius: 14, greet: 'TODAY', titleSize: 44, titleWeight: 800, tabActive: '#C6F432',
  },
  c: {
    name: 'Tend',
    fonts: 'family=Inter:wght@400;500;600&family=Fraunces:opsz,wght@9..144,500;9..144,600',
    body: 'Inter',
    display: 'Fraunces',
    bg: '#F4F1EA', card: '#FFFFFF', card2: '#EDE8DD', text: '#2B2A27', muted: '#7A776F',
    accent: '#5E7F64', onAccent: '#FFFFFF', accent2: '#D9774B', warn: '#D9774B',
    radius: 18, greet: 'Take care today', titleSize: 32, titleWeight: 500, tabActive: '#5E7F64', border: '#E2DDD2',
  },
};

const icon = (name, size = 22) => `<i class="ti ti-${name}" style="font-size:${size}px"></i>`;

function page(key) {
  const t = themes[key];
  const border = t.border ? `border:1px solid ${t.border};` : '';
  const card = `background:${t.card};border-radius:${t.radius}px;padding:16px;${border}`;
  const bar = (pct, color) =>
    `<div style="height:8px;border-radius:4px;background:${t.card2};overflow:hidden;margin:6px 0 12px"><div style="width:${pct}%;height:100%;background:${color};border-radius:4px"></div></div>`;
  const quick = [
    ['camera', 'Snapshot'],
    ['barcode', 'Barcode'],
    ['tools-kitchen-2', 'Saved'],
    ['mood-smile', 'Check-in'],
  ]
    .map(
      ([i, l]) =>
        `<div style="${card}padding:12px 0;display:flex;flex-direction:column;align-items:center;gap:6px;color:${t.accent}">${icon(i, 24)}<span style="color:${t.text};font-size:12px;font-weight:500">${l}</span></div>`,
    )
    .join('');
  const tabs = [
    ['sun', 'Today', true],
    ['salad', 'Food'],
    ['barbell', 'Workouts'],
    ['books', 'Library'],
    ['brain', 'Mind'],
    ['chart-line', 'Progress'],
  ]
    .map(
      ([i, l, on]) =>
        `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;color:${on ? t.tabActive : t.muted}">${icon(i, 24)}<span style="font-size:10px;font-weight:${on ? 600 : 500}">${l}</span></div>`,
    )
    .join('');

  // Direction-specific hero (nutrition) block
  const nutritionA = `
    <div style="${card}">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600">Nutrition</span><span style="color:${t.muted};font-size:13px">1,160 kcal left</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:14px"><span>Calories</span><span style="color:${t.muted}">1,240 / 2,400</span></div>${bar(52, t.accent)}
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>Protein</span><span style="color:${t.muted}">92 / 160 g</span></div>${bar(57, t.accent2)}
      <div style="display:flex;gap:8px;align-items:center;font-size:13px;color:${t.warn}">${icon('alert-triangle', 16)}Sodium close to limit · 1,980 / 2,300 mg</div>
    </div>`;
  const ring = (r, w, pct, color) => {
    const c = 2 * Math.PI * r;
    return `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${t.card2}" stroke-width="${w}"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(c * pct) / 100} ${c}" transform="rotate(-90 60 60)"/>`;
  };
  const nutritionB = `
    <div style="${card}display:flex;gap:16px;align-items:center">
      <svg width="120" height="120" viewBox="0 0 120 120">${ring(50, 14, 52, t.accent)}${ring(31, 12, 57, t.accent2)}</svg>
      <div>
        <div style="font-family:'${t.display}';font-size:46px;font-weight:800;line-height:1">1,240</div>
        <div style="color:${t.muted};font-size:13px;margin-bottom:8px">of 2,400 kcal</div>
        <div style="font-family:'${t.display}';font-size:26px;font-weight:700;color:${t.accent2};line-height:1">92 G</div>
        <div style="color:${t.muted};font-size:13px">of 160 g protein</div>
      </div>
    </div>`;
  const nutritionC = `
    <div style="${card}">
      <div style="font-family:'${t.display}';font-size:20px;margin-bottom:6px">Nourishment</div>
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>1,240 kcal</span><span style="color:${t.muted}">of 2,400</span></div>${bar(52, t.accent)}
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>92 g protein</span><span style="color:${t.muted}">of 160</span></div>${bar(57, t.accent2)}
      <div style="font-size:13px;color:${t.muted}">Fiber 12 of 30 g, add some beans or berries today.</div>
    </div>`;

  const workoutA = `
    <div style="${card}">
      <div style="color:${t.muted};font-size:13px">Today's workout · 6:05 AM</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
        <div><div style="font-size:20px;font-weight:600">Back &amp; Shoulder</div><div style="color:${t.muted};font-size:13px">15 exercises · ~60 min</div></div>
        <div style="background:${t.accent};color:${t.onAccent};border-radius:999px;padding:10px 20px;font-weight:600">Start</div>
      </div>
    </div>`;
  const workoutB = `
    <div style="background:${t.accent};color:${t.onAccent};border-radius:${t.radius}px;padding:16px;display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:13px;font-weight:600;opacity:.75">06:05 · BACK &amp; SHOULDER</div><div style="font-family:'${t.display}';font-size:30px;font-weight:800;line-height:1.1">START WORKOUT</div></div>
      ${icon('arrow-right', 30)}
    </div>`;
  const workoutC = `
    <div style="${card}display:flex;justify-content:space-between;align-items:center">
      <div><div style="color:${t.muted};font-size:13px">6:05 AM</div><div style="font-family:'${t.display}';font-size:22px">Back &amp; Shoulder</div></div>
      <div style="border:1.5px solid ${t.accent};color:${t.accent};border-radius:999px;padding:9px 20px;font-weight:600">Start</div>
    </div>`;

  const careRow = (label, time) =>
    `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid ${t.card2}"><div style="flex:1"><div style="font-weight:500">${label}</div><div style="color:${t.muted};font-size:12px">${time}</div></div><div style="background:${t.card2};color:${t.muted};border-radius:10px;padding:7px 12px;font-size:13px">Skip</div><div style="background:${t.accent};color:${t.onAccent};border-radius:10px;padding:7px 12px;font-size:13px;font-weight:600">Done</div></div>`;
  const care = `<div style="${card}padding-bottom:6px"><div style="font-weight:600;margin-bottom:4px${key === 'c' ? `;font-family:'${t.display}';font-size:18px;font-weight:500` : ''}">${key === 'b' ? 'CARE' : 'Care still due'}</div>${careRow('Morning routine', '8:00 AM')}${careRow('Evening routine', '9:30 PM')}</div>`;

  const header =
    key === 'b'
      ? `<div style="display:flex;justify-content:space-between;align-items:flex-end"><div style="font-family:'${t.display}';font-size:${t.titleSize}px;font-weight:${t.titleWeight};line-height:1">${t.greet}</div><div style="color:${t.muted};font-weight:600">MON 19 OCT</div></div>`
      : `<div style="color:${t.muted};font-size:14px">Monday, October 19</div><div style="font-family:'${t.display}';font-size:${t.titleSize}px;font-weight:${t.titleWeight};letter-spacing:-0.5px">${t.greet}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${t.fonts}&display=block">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<style>*{box-sizing:border-box;margin:0}html,body{width:390px;height:844px;overflow:hidden}
body{background:${t.bg};color:${t.text};font-family:'${t.body}',sans-serif;font-size:15px;position:relative}</style></head><body>
<div style="height:47px;display:flex;justify-content:space-between;align-items:center;padding:0 28px 0 34px;font-weight:600;font-size:16px"><span>9:41</span><span style="display:flex;gap:6px">${icon('antenna-bars-5', 18)}${icon('wifi', 18)}${icon('battery-3', 20)}</span></div>
<div style="padding:8px 16px 0;display:flex;flex-direction:column;gap:12px">
  ${header}
  ${key === 'a' ? workoutA : key === 'b' ? workoutB : workoutC}
  ${key === 'a' ? nutritionA : key === 'b' ? nutritionB : nutritionC}
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${quick}</div>
  ${care}
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:84px;padding:8px 6px 0;display:flex;background:${key === 'c' ? '#FFFFFF' : t.card};border-top:1px solid ${t.border ?? t.card2}">${tabs}</div>
</body></html>`;
}

for (const key of Object.keys(themes)) writeFileSync(join(here, `mockup-${key}.html`), page(key));
console.log('wrote', Object.keys(themes).map((k) => `mockup-${k}.html`).join(', '));
