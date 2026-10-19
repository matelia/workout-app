import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

type MindLock = { unlocked: boolean; unlock: () => Promise<boolean>; lock: () => void };

const Ctx = createContext<MindLock>({ unlocked: false, unlock: async () => false, lock: () => {} });

/**
 * Face ID gate for Mind data. Unlock lasts until the app goes to the background.
 * If the phone has no Face ID/passcode at all, access is allowed (nothing to check against).
 */
export function MindLockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  async function unlock() {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) {
      setUnlocked(true);
      return true;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Mind',
      fallbackLabel: 'Use passcode',
    });
    setUnlocked(res.success);
    return res.success;
  }

  return <Ctx.Provider value={{ unlocked, unlock, lock: () => setUnlocked(false) }}>{children}</Ctx.Provider>;
}

export const useMindLock = () => useContext(Ctx);
