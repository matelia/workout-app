import Svg, { Circle, Path } from 'react-native-svg';
import type { SFSymbol } from 'expo-symbols';

export const MOODS = [
  { value: 5, label: 'rad', color: '#19B890' },
  { value: 4, label: 'good', color: '#8CC63F' },
  { value: 3, label: 'meh', color: '#4A9FD5' },
  { value: 2, label: 'bad', color: '#F28C22' },
  { value: 1, label: 'awful', color: '#E81E3A' },
] as const;

export const moodInfo = (value: number | null) => MOODS.find((m) => m.value === value) ?? null;

const INK = '#1A1A1A';

/** Simple drawn mood face, 1 (awful) … 5 (rad). */
export function MoodFace({ mood, size = 64, dim = false }: { mood: number; size?: number; dim?: boolean }) {
  const info = moodInfo(mood) ?? MOODS[2];
  const stroke = { stroke: INK, strokeWidth: 5, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={dim ? 0.35 : 1}>
      <Circle cx={50} cy={50} r={48} fill={info.color} />
      {mood === 5 ? (
        <>
          {/* closed, smiling eyes + big open grin */}
          <Path d="M24 40 Q31 33 38 40" {...stroke} />
          <Path d="M62 40 Q69 33 76 40" {...stroke} />
          <Path d="M30 54 Q50 82 70 54 Z" fill={INK} />
          <Path d="M40 68 Q50 74 60 68" stroke="#fff" strokeWidth={4} fill="none" />
        </>
      ) : mood === 4 ? (
        <>
          <Circle cx={33} cy={45} r={5.5} fill={INK} />
          <Circle cx={67} cy={45} r={5.5} fill={INK} />
          <Path d="M40 60 Q50 70 60 60" {...stroke} />
        </>
      ) : mood === 3 ? (
        <>
          <Circle cx={33} cy={46} r={5.5} fill={INK} />
          <Circle cx={67} cy={46} r={5.5} fill={INK} />
          <Path d="M39 63 L61 63" {...stroke} />
        </>
      ) : mood === 2 ? (
        <>
          <Path d="M26 34 Q31 29 37 32" {...stroke} strokeWidth={4} />
          <Path d="M63 32 Q69 29 74 34" {...stroke} strokeWidth={4} />
          <Circle cx={33} cy={47} r={5.5} fill={INK} />
          <Circle cx={67} cy={47} r={5.5} fill={INK} />
          <Path d="M38 70 Q50 56 62 70" {...stroke} />
        </>
      ) : (
        <>
          <Path d="M26 38 L37 44 L26 50" {...stroke} strokeWidth={4.5} />
          <Path d="M74 38 L63 44 L74 50" {...stroke} strokeWidth={4.5} />
          <Path d="M36 72 Q50 56 64 72" {...stroke} />
        </>
      )}
    </Svg>
  );
}

/** Emotion choices for the check-in. Stored in mood_checkin.tags. */
export const EMOTIONS: { key: string; icon: SFSymbol }[] = [
  { key: 'happy', icon: 'balloon.2.fill' },
  { key: 'excited', icon: 'party.popper.fill' },
  { key: 'grateful', icon: 'heart.fill' },
  { key: 'relaxed', icon: 'beach.umbrella.fill' },
  { key: 'content', icon: 'hands.and.sparkles.fill' },
  { key: 'tired', icon: 'bed.double.fill' },
  { key: 'unsure', icon: 'questionmark.bubble.fill' },
  { key: 'bored', icon: 'leaf.fill' },
  { key: 'anxious', icon: 'cloud.bolt.rain.fill' },
  { key: 'angry', icon: 'flame.fill' },
  { key: 'stressed', icon: 'bolt.heart.fill' },
  { key: 'sad', icon: 'drop.fill' },
  { key: 'desperate', icon: 'hand.raised.fill' },
];
export const CUSTOM_EMOTION_ICON: SFSymbol = 'tag.fill';
