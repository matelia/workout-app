import type { SQLiteDatabase } from 'expo-sqlite';

// Start each library video at the demonstration instead of the intro. Times come from
// YouTube's "Most replayed" data (2026-10-19), skipping the opening seconds; videos under
// 30 s start at 0. Only applied where the video is still the one we picked.
const START: Record<string, number> = {
  '3VcKaXpzqRo': 83, '-t7fuZ0KhDA': 31, '-4qRntuXBSc': 44, '6TSP1TRMUzs': 108, GZbfZ033f74: 101,
  trZQjegcRx0: 21, 'rep-qVOkqgk': 105, XagV4XfG9fo: 25, ph3pddpKzzw: 62, '9hSQVBHLOX0': 40,
  cJRVVxmytaM: 74, NAqCVe2mwzM: 89, 'Wab3-dsZohU': 57, xUm0BiZCWlQ: 137, gRVjAtPip0Y: 106,
  ig0NyNlSce4: 29, DbFgADa2PL8: 183, Z57CtFmRMxA: 30, eozdVDA78K0: 112, taI4XduLpTk: 58,
  Z0bRiVhnO8Q: 56, ykJmrZ5v0Oo: 63, Gydpcouclx8: 63, NFzTWp2qpiE: 26, M_uPvGrMx_o: 80,
  d_KZxkY_0cM: 121, '6kALZikXxLc': 44, qMtmHwaCmYI: 45, CtyIVeJH6lI: 62, '3UWi44yN-wM': 46,
  hQgFixeXdZo: 67, NaKsZos0bIY: 63, ELOCsoDSmrg: 47, IZxyjW7MPJQ: 43,
};

export async function up(db: SQLiteDatabase) {
  for (const [id, start] of Object.entries(START)) {
    await db.runAsync(
      "UPDATE exercise SET video_url_or_path = ? WHERE video_type = 'youtube' AND video_url_or_path = ?",
      `https://youtu.be/${id}?t=${start}`,
      `https://youtu.be/${id}`,
    );
  }
}
