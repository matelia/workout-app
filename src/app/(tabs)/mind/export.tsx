import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { DateField } from '@/components/pickers';
import { Button, Card, Screen, T } from '@/components/ui';
import { listCheckIns, listJournalBetween, listTherapyBetween } from '@/db/repos/mind';
import { addDays, formatDate, todayStr } from '@/lib/dates';
import { space, useColors } from '@/theme';

/**
 * Builds a plain-text summary for a date range and opens the iOS share sheet.
 * Nothing is uploaded by the app; you choose where it goes (AirDrop, Mail, Files…).
 */
export default function TherapistExport() {
  const db = useSQLiteContext();
  const c = useColors();
  const [from, setFrom] = useState(addDays(todayStr(), -30));
  const [to, setTo] = useState(todayStr());
  const [withCheckIns, setWithCheckIns] = useState(true);
  const [withJournal, setWithJournal] = useState(true);
  const [flaggedOnly, setFlaggedOnly] = useState(true);
  const [withTherapy, setWithTherapy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportNow() {
    setError(null);
    if (from > to) return setError('Start date is after end date.');
    const lines: string[] = [`Summary ${formatDate(from)} – ${formatDate(to)}`, ''];

    if (withCheckIns) {
      const rows = await listCheckIns(db, from, to);
      lines.push('DAILY CHECK-INS', 'date | mood (1-5) | energy (1-5) | sleep h | tags | note');
      for (const r of rows) {
        const tags = r.tags ? (JSON.parse(r.tags) as string[]).join(', ') : '';
        lines.push([r.date, r.mood ?? '', r.energy ?? '', r.sleep_hours ?? '', tags, r.note ?? ''].join(' | '));
      }
      if (!rows.length) lines.push('(none)');
      lines.push('');
    }
    if (withJournal) {
      const rows = await listJournalBetween(db, from, to, flaggedOnly);
      lines.push(flaggedOnly ? 'JOURNAL (flagged for therapy)' : 'JOURNAL');
      for (const r of rows) lines.push(`— ${r.datetime.replace('T', ' ').slice(0, 16)}`, r.text, '');
      if (!rows.length) lines.push('(none)', '');
    }
    if (withTherapy) {
      const rows = await listTherapyBetween(db, from, to);
      lines.push('THERAPY SESSION NOTES');
      for (const r of rows) {
        lines.push(`— ${r.date}`);
        if (r.notes) lines.push(`Notes: ${r.notes}`);
        if (r.takeaways) lines.push(`Takeaways: ${r.takeaways}`);
        if (r.homework) lines.push(`Homework: ${r.homework}`);
        lines.push('');
      }
      if (!rows.length) lines.push('(none)', '');
    }

    const file = new File(Paths.cache, `summary-${from}-to-${to}.txt`);
    if (file.exists) file.delete();
    file.create();
    file.write(lines.join('\n'));
    await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: 'Share summary' });
  }

  const toggle = (label: string, value: boolean, set: (v: boolean) => void, indent = false) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: indent ? space.lg : 0 }}>
      <T style={{ flex: 1 }}>{label}</T>
      <Switch value={value} onValueChange={set} />
    </View>
  );

  return (
    <Screen>
      <T variant="muted">
        Creates a text file on this phone and opens the share sheet. The app never uploads it. Care items (meds,
        etc.) are not included.
      </T>
      <Card>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </Card>
      <Card>
        {toggle('Daily check-ins', withCheckIns, setWithCheckIns)}
        {toggle('Journal entries', withJournal, setWithJournal)}
        {withJournal ? toggle('Only “bring to therapy” entries', flaggedOnly, setFlaggedOnly, true) : null}
        {toggle('My therapy session notes', withTherapy, setWithTherapy)}
      </Card>
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      <Button title="Create & share" onPress={exportNow} />
    </Screen>
  );
}
