import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { ALL_ON, type FeatureKey, type Flags, loadFeatures, saveFeature } from '@/lib/featureStore';

export { FEATURES, type FeatureKey, type Flags, isFeatureOn } from '@/lib/featureStore';

type Ctx = { flags: Flags; ready: boolean; setFeature: (key: FeatureKey, on: boolean) => Promise<void>; reload: () => Promise<void> };
const FeaturesContext = createContext<Ctx>({ flags: ALL_ON, ready: false, setFeature: async () => {}, reload: async () => {} });

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [flags, setFlags] = useState<Flags>(ALL_ON);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    setFlags(await loadFeatures(db));
    setReady(true);
  }, [db]);

  useEffect(() => {
    loadFeatures(db).then((f) => {
      setFlags(f);
      setReady(true);
    });
  }, [db]);

  const setFeature = useCallback(
    async (key: FeatureKey, on: boolean) => {
      await saveFeature(db, key, on);
      setFlags(await loadFeatures(db));
    },
    [db],
  );

  return <FeaturesContext.Provider value={{ flags, ready, setFeature, reload }}>{children}</FeaturesContext.Provider>;
}

export const useFeatures = () => useContext(FeaturesContext);
