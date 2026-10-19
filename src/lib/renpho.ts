import type { MetricField, MetricInput } from '@/db/repos/bodyMetrics';

// Parses a Renpho Health CSV export. Column names vary by app version and language/unit
// settings, so headers are matched by keywords and units are read from the header.

const KG_TO_LB = 2.20462;

type Rule = { field: MetricField; match: RegExp; mass?: boolean };
const RULES: Rule[] = [
  { field: 'skeletal_muscle_pct', match: /skeletal\s*muscle/i },
  { field: 'muscle_mass_lb', match: /muscle\s*mass/i, mass: true },
  { field: 'lean_mass_lb', match: /(fat[-\s]?free|lean).*(mass|weight)/i, mass: true },
  { field: 'body_fat_pct', match: /^(body\s*)?fat(\s*\(%\)|\s*%|\s*rate)?$|body\s*fat/i },
  { field: 'visceral_fat', match: /visceral/i },
  { field: 'body_water_pct', match: /water/i },
  { field: 'bone_mass_lb', match: /bone/i, mass: true },
  { field: 'bmr_kcal', match: /bmr|basal/i },
  { field: 'metabolic_age', match: /metabolic\s*age|body\s*age/i },
  { field: 'bmi', match: /^bmi|body\s*mass\s*index/i },
  { field: 'weight_lb', match: /^weight|^body\s*weight/i, mass: true },
];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Accepts 2024-05-01 07:30(:12), 2024/5/1 7:30, 05/01/2024 7:30 PM, "Jan 5, 2024 7:30 AM", … */
export function parseRenphoDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, mo: number, d: number;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) [y, mo, d] = [+m[3], +m[1], +m[2]]; // US month/day
  else {
    const t = Date.parse(s.replace(/\s+at\s+/i, ' '));
    if (Number.isNaN(t)) return null;
    const dt = new Date(t);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }
  const tm = s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
  let h = tm ? +tm[1] : 12;
  const min = tm ? +tm[2] : 0;
  if (tm?.[3]) h = (h % 12) + (tm[3].toUpperCase() === 'PM' ? 12 : 0);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(min)}`;
}

const num = (s: string | undefined) => {
  if (!s) return null;
  const v = parseFloat(s.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

export function parseRenphoCsv(text: string): { rows: MetricInput[]; columns: MetricField[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], columns: [] };
  const header = splitCsvLine(lines[0]);
  const dateCol = header.findIndex((h) => /time|date/i.test(h));
  if (dateCol === -1) throw new Error('No date/time column found. Is this a Renpho export?');

  const used = new Set<number>([dateCol]);
  const cols: { idx: number; field: MetricField; kg: boolean }[] = [];
  for (const rule of RULES) {
    const idx = header.findIndex((h, i) => !used.has(i) && rule.match.test(h.replace(/\(.*?\)/g, '').trim()));
    if (idx === -1) continue;
    used.add(idx);
    cols.push({ idx, field: rule.field, kg: !!rule.mass && /kg/i.test(header[idx]) });
  }

  const rows: MetricInput[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const at = parseRenphoDate(cells[dateCol] ?? '');
    if (!at) continue;
    const row: MetricInput = { measured_at: at, source: 'renpho' };
    for (const c of cols) {
      let v = num(cells[c.idx]);
      if (v !== null && c.kg) v = Math.round(v * KG_TO_LB * 10) / 10;
      if (v !== null && v !== 0) row[c.field] = v;
    }
    rows.push(row);
  }
  return { rows, columns: cols.map((c) => c.field) };
}
