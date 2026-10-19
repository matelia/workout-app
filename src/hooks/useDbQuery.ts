import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

/**
 * Runs a DB read when the screen gains focus (so data is fresh after editing elsewhere).
 * `key` should change whenever the query's inputs change.
 */
export function useDbQuery<T>(query: (db: SQLiteDatabase) => Promise<T>, key: string = '') {
  const db = useSQLiteContext();
  const [data, setData] = useState<T | undefined>(undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => setData(await query(db)), [db, key]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, reload };
}
