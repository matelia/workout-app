import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

import { cancelRestDone, scheduleRestDone } from '@/lib/notifications';

/**
 * Countdown based on an absolute end time, so it stays correct if the app is backgrounded.
 * A local notification fires at the end in case the phone is locked.
 */
export function useRestTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);

  useEffect(() => {
    if (endAt === null) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= endAt && !fired.current) {
        fired.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEndAt(null);
      }
    }, 250);
    return () => clearInterval(t);
  }, [endAt]);

  function start(seconds: number) {
    fired.current = false;
    const end = Date.now() + seconds * 1000;
    setNow(Date.now());
    setEndAt(end);
    scheduleRestDone(seconds);
  }

  function adjust(deltaSeconds: number) {
    if (endAt === null) return;
    const end = Math.max(Date.now() + 1000, endAt + deltaSeconds * 1000);
    setEndAt(end);
    scheduleRestDone((end - Date.now()) / 1000);
  }

  function skip() {
    setEndAt(null);
    cancelRestDone();
  }

  const remaining = endAt === null ? 0 : Math.max(0, (endAt - now) / 1000);
  return { active: endAt !== null, remaining, start, adjust, skip };
}
