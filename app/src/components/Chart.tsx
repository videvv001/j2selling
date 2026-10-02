import { useState } from 'react';
import { sx } from '../lib/sx';

export interface ChartDatum { label: string; value: number; muted?: boolean }
export type ChartFormat = 'num' | 'peso' | 'pesoShort' | 'pct' | 'days' | 'hours';

interface ChartProps {
  type?: 'bar' | 'line' | 'hbar';
  data: ChartDatum[];
  format?: ChartFormat;
  height?: number;
  color?: 'accent' | 'ink';
  unit?: string;
  /** Label of a datum to highlight (e.g. the active filter). */
  selected?: string;
  /** Approximate number of x-axis tick labels. */
  ticks?: number;
  summaryLabel?: string;
  summaryValue?: string;
  onSelect?: (d: ChartDatum, i: number) => void;
}

export function formatValue(v: number, f: ChartFormat = 'num'): string {
  if (f === 'peso') return '₱' + Math.round(v).toLocaleString('en-PH');
  if (f === 'pesoShort') return v >= 1e6 ? '₱' + (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? '₱' + Math.round(v / 1e3) + 'K' : '₱' + Math.round(v);
  if (f === 'pct') return (+v).toFixed(1) + '%';
  if (f === 'days') return (+v).toFixed(1) + ' d';
  if (f === 'hours') return (+v).toFixed(1) + ' h';
  return Math.round(v).toLocaleString('en-PH');
}

/** Bar, line and horizontal-bar chart with a hover read-out above the plot. */
export function Chart({ type = 'bar', data, format = 'num', height = 160, color = 'accent', unit = '', selected, ticks = 7, summaryLabel, summaryValue, onSelect }: ChartProps) {
  const [hover, setHover] = useState(-1);
  const fmtv = (v: number) => formatValue(v, format);
  const accent = color === 'ink' ? 'var(--color-text)' : 'var(--color-accent)';
  const max = Math.max(1, ...data.map(d => d.value));
  const n = data.length;
  const every = Math.max(1, Math.ceil(n / ticks));
  const gap = n > 20 ? '2px' : '6px';
  const h = height + 'px';
  const bars = data.map((d, i) => ({
    ...d,
    pct: (d.value / max * 100) + '%',
    color: i === hover || d.label === selected ? (color === 'ink' ? 'var(--color-accent)' : 'var(--color-accent-700)') : (d.muted ? 'var(--color-neutral-400)' : accent),
    tick: type === 'hbar' ? '' : (i % every === 0 ? d.label : ''),
    enter: () => setHover(i),
    click: () => onSelect?.(d, i),
  }));
  const leave = () => setHover(-1);
  const pts = data.map((d, i) => [n > 1 ? i / (n - 1) * 100 : 50, 100 - d.value / max * 94]);
  const lineD = pts.length ? 'M' + pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L') : '';
  const areaD = pts.length ? lineD + ' L100 100 L0 100 Z' : '';
  const cur = hover >= 0 ? data[hover] : null;
  const total = data.reduce((a, d) => a + d.value, 0);
  const u = unit ? ' ' + unit : '';
  const readLabel = cur ? cur.label : (summaryLabel || 'Total');
  const readValue = cur ? fmtv(cur.value) + u : (summaryValue != null ? summaryValue : fmtv(total) + u);

  const grid = (
    <>
      <div style={sx('position:absolute;left:0;right:0;top:0;border-top:1px dashed var(--color-neutral-300)')} />
      <div style={sx('position:absolute;left:0;right:0;top:50%;border-top:1px dashed var(--color-neutral-300)')} />
    </>
  );
  const tickRow = (withGap: boolean) => (
    <div style={{ ...sx('display:flex;font-size:10px;color:var(--color-neutral-600)'), gap: withGap ? gap : undefined }}>
      {bars.map((b, i) => <div key={i} style={sx('flex:1;min-width:0;white-space:nowrap;overflow:visible')}>{b.tick}</div>)}
    </div>
  );

  return (
    <div style={sx('display:flex;flex-direction:column;gap:8px;width:100%;font-family:var(--font-body)')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px;min-height:18px')}>
        <span style={sx('color:var(--color-neutral-700)')}>{readLabel}</span>
        <strong style={sx('font-variant-numeric:tabular-nums')}>{readValue}</strong>
      </div>
      {type === 'bar' && (
        <>
          <div style={{ ...sx('position:relative;border-bottom:2px solid var(--color-divider);display:flex;align-items:flex-end'), height: h, gap }}>
            {grid}
            <span style={sx('position:absolute;left:0;top:-2px;font-size:10px;color:var(--color-neutral-600);background:var(--color-bg);padding-right:4px')}>{fmtv(max)}</span>
            {bars.map((b, i) => (
              <div key={i} onMouseEnter={b.enter} onMouseLeave={leave} onClick={b.click} style={sx('flex:1;height:100%;display:flex;align-items:flex-end;cursor:pointer;position:relative;z-index:1')}>
                <div style={{ width: '100%', height: b.pct, background: b.color, minHeight: 2 }} />
              </div>
            ))}
          </div>
          {tickRow(true)}
        </>
      )}
      {type === 'line' && (
        <>
          <div style={{ ...sx('position:relative;border-bottom:2px solid var(--color-divider)'), height: h }}>
            {grid}
            <span style={sx('position:absolute;left:0;top:-2px;font-size:10px;color:var(--color-neutral-600);background:var(--color-bg);padding-right:4px;z-index:1')}>{fmtv(max)}</span>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={sx('position:absolute;inset:0;width:100%;height:100%;overflow:visible')}>
              <path d={areaD} style={sx('fill:var(--color-accent-100);stroke:none')} />
              <path d={lineD} style={{ fill: 'none', stroke: accent, strokeWidth: '2px', vectorEffect: 'non-scaling-stroke' }} />
            </svg>
            {hover >= 0 && (
              <>
                <div style={{ ...sx('position:absolute;top:0;bottom:0;width:1px;background:var(--color-text)'), left: pts[hover][0] + '%' }} />
                <div style={{ ...sx('position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;background:var(--color-accent);border:2px solid var(--color-bg)'), left: pts[hover][0] + '%', top: pts[hover][1] + '%' }} />
              </>
            )}
            <div style={sx('position:absolute;inset:0;display:flex')}>
              {bars.map((b, i) => <div key={i} onMouseEnter={b.enter} onMouseLeave={leave} onClick={b.click} style={sx('flex:1;height:100%;cursor:crosshair')} />)}
            </div>
          </div>
          {tickRow(false)}
        </>
      )}
      {type === 'hbar' && (
        <div style={sx('display:flex;flex-direction:column;gap:6px')}>
          {bars.map((b, i) => (
            <div key={i} onMouseEnter={b.enter} onMouseLeave={leave} onClick={b.click} style={{ ...sx('display:grid;grid-template-columns:minmax(72px,34%) minmax(0,1fr) auto;gap:10px;align-items:center;font-size:12px;cursor:pointer;padding:1px 0'), background: i === hover ? 'var(--color-neutral-200)' : 'transparent' }}>
              <span style={sx('white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{b.label}</span>
              <div style={sx('height:12px;background:var(--color-neutral-200)')}>
                <div style={{ height: '100%', width: b.pct, background: b.color }} />
              </div>
              <span style={sx('font-variant-numeric:tabular-nums;min-width:52px;text-align:right')}>{fmtv(b.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
