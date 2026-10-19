import Svg, { Circle, G } from 'react-native-svg';

import { useColors } from '@/theme';

/** Concentric progress rings (outer first). Values are 0..1; over 1 is drawn full. */
export function Rings({ rings, size = 124 }: { rings: { value: number; color: string }[]; size?: number }) {
  const c = useColors();
  const stroke = size * 0.11;
  const gap = stroke * 0.45;
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      {rings.map((ring, i) => {
        const r = center - stroke / 2 - i * (stroke + gap);
        const circ = 2 * Math.PI * r;
        const pct = Math.max(0, Math.min(1, ring.value));
        return (
          <G key={i}>
            <Circle cx={center} cy={center} r={r} stroke={c.card2} strokeWidth={stroke} fill="none" />
            {pct > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={r}
                stroke={ring.color}
                strokeWidth={stroke}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${circ * pct} ${circ}`}
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
}
