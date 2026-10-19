import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { View } from 'react-native';

import { Empty, Row, Screen, T } from '@/components/ui';
import { loggedExercises } from '@/db/repos/progress';
import { setSetting } from '@/db/repos/settings';
import { useDbQuery } from '@/hooks/useDbQuery';

export default function PickExercise() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { data } = useDbQuery(loggedExercises);

  return (
    <Screen>
      {data?.length === 0 ? <Empty title="No lifts logged yet" hint="Finish a workout with weights to see charts." /> : null}
      {data?.map((e) => (
        <Row
          key={e.id}
          onPress={async () => {
            await setSetting(db, 'progress_exercise', String(e.id));
            router.back();
          }}>
          <View style={{ flex: 1 }}>
            <T>{e.name}</T>
            <T variant="muted">{e.sessions} sessions</T>
          </View>
        </Row>
      ))}
    </Screen>
  );
}
