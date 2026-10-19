import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { T } from '@/components/ui';
import { useColors } from '@/theme';

export type Point = { label: string; value: number };

const PAD = { top: 12, right: 12, bottom: 22, left: 36 };

function niceRange(values: number[], fixed?: [number, number]): [number, number] {
  if (fixed) return fixed;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/** Minimal line chart: first/last x labels, 3 y gridlines, dots on each point. */
export function LineChart({
  data,
  height = 180,
  yDomain,
  unit = '',
}: {
  data: Point[];
  height?: number;
  yDomain?: [number, number];
  unit?: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  if (data.length === 0) return <T variant="muted">No data yet.</T>;

  const [lo, hi] = niceRange(data.map((d) => d.value), yDomain);
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (data.length === 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => PAD.top + h - ((v - lo) / (hi - lo)) * h;
  const ticks = [lo, (lo + hi) / 2, hi];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((t) => (
            <Line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={c.border} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`l${t}`} x={PAD.left - 6} y={y(t) + 4} fontSize={10} fill={c.textMuted} textAnchor="end">
              {Number.isInteger(t) ? t : t.toFixed(1)}
              {unit}
            </SvgText>
          ))}
          <Polyline
            points={data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ')}
            fill="none"
            stroke={c.accent}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
          {data.map((d, i) => (
            <Circle key={i} cx={x(i)} cy={y(d.value)} r={3.5} fill={c.accent} />
          ))}
          <SvgText x={x(0)} y={height - 6} fontSize={10} fill={c.textMuted} textAnchor="start">
            {data[0].label}
          </SvgText>
          {data.length > 1 ? (
            <SvgText x={x(data.length - 1)} y={height - 6} fontSize={10} fill={c.textMuted} textAnchor="end">
              {data[data.length - 1].label}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

/** Vertical bars with an optional target line. */
export function BarChart({
  data,
  height = 180,
  target,
}: {
  data: Point[];
  height?: number;
  target?: number | null;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  if (data.length === 0) return <T variant="muted">No data yet.</T>;

  const max = Math.max(...data.map((d) => d.value), target ?? 0) * 1.1 || 1;
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const slot = w / data.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + h - (v / max) * h;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line x1={PAD.left} x2={width - PAD.right} y1={y(0)} y2={y(0)} stroke={c.border} />
          <SvgText x={PAD.left - 6} y={y(max / 1.1) + 4} fontSize={10} fill={c.textMuted} textAnchor="end">
            {Math.round(max / 1.1)}
          </SvgText>
          {data.map((d, i) => (
            <Rect
              key={i}
              x={PAD.left + i * slot + (slot - barW) / 2}
              y={y(d.value)}
              width={barW}
              height={Math.max(0, y(0) - y(d.value))}
              rx={4}
              fill={c.accent}
            />
          ))}
          {data.map((d, i) => (
            <SvgText key={`t${i}`} x={PAD.left + i * slot + slot / 2} y={height - 6} fontSize={10} fill={c.textMuted} textAnchor="middle">
              {d.label}
            </SvgText>
          ))}
          {target ? (
            <Line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(target)}
              y2={y(target)}
              stroke={c.accent2}
              strokeDasharray="4 4"
              strokeWidth={1.5}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
