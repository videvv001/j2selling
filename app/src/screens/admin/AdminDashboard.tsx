import { useState } from 'react';
import { Chart } from '../../components/Chart';
import { sx } from '../../lib/sx';
import { DA, MAKE_SHARE, RANGE_LABEL, fmt, type Change, type CustomRange, type Range } from '../../store';

const RANGES: Range[] = ['today', 'week', 'month', 'quarter', 'year', 'custom'];

/** Shared by the dashboard and reports: the selected reporting range lives in store UI state. */
export function currentRange() {
  const ui = DA.S.ui || {};
  const range = (ui.range as Range) || 'month';
  const custom = (ui.custom as CustomRange) || { from: '2026-09-01', to: '2026-09-29' };
  const rangeDates = ({ today: 'Sep 29, 2026', week: 'Sep 23 – 29, 2026', month: 'Sep 1 – 29, 2026', quarter: 'Jul 1 – Sep 29, 2026', year: 'Jan 1 – Sep 29, 2026', custom: fmt.dateY(Date.parse(custom.from)) + ' – ' + fmt.dateY(Date.parse(custom.to)) } as Record<Range, string>)[range];
  return { range, custom, rangeDates, rangeLabel: RANGE_LABEL[range] };
}

export function RangePicker() {
  const { range, custom } = currentRange();
  return (
    <div style={sx('display:flex;flex-direction:column;gap:8px;align-items:flex-end')}>
      <div style={sx('display:flex;flex-wrap:wrap;border:1px solid var(--color-divider)')}>
        {RANGES.map(r => (
          <button key={r} onClick={() => DA.setUI({ range: r })} style={{ ...sx('font:inherit;font-size:12.5px;padding:7px 11px;border:0;cursor:pointer'), background: r === range ? 'var(--color-text)' : 'transparent', color: r === range ? 'var(--color-bg)' : 'var(--color-text)', fontWeight: r === range ? 700 : 400 }}>{RANGE_LABEL[r]}</button>
        ))}
      </div>
      {range === 'custom' && (
        <div style={sx('display:flex;gap:8px;align-items:center;font-size:12px')}>
          <input type="date" className="input" value={custom.from} onChange={e => DA.setUI({ custom: { ...custom, from: e.target.value } })} min="2026-01-01" max="2026-09-29" style={sx('min-height:32px;width:auto')} />
          <span>to</span>
          <input type="date" className="input" value={custom.to} onChange={e => DA.setUI({ custom: { ...custom, to: e.target.value } })} min="2026-01-01" max="2026-09-29" style={sx('min-height:32px;width:auto')} />
        </div>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const S = DA.S;
  const [stage, setStage] = useState(5);
  const [attn, setAttn] = useState('All');
  const { range, custom, rangeDates, rangeLabel } = currentRange();
  const k = DA.kpis(range, custom), ser = DA.series(range, custom);
  const ch = (c: Change, invert?: boolean) => ({ change: c.txt, chColor: (invert ? !c.up : c.up) ? 'var(--color-neutral-800)' : 'var(--color-accent-700)' });
  const q = (p: string) => () => DA.go('admin', p);
  const kpis = [
    { label: 'Cars submitted', value: fmt.num(k.sub), onClick: q('submissions'), tip: 'All vehicle submissions in the period', ...ch(k.change.sub) },
    { label: 'Awaiting valuation', value: fmt.num(k.awaiting), onClick: q('valuations'), tip: 'Submitted, under review or valuation in progress — right now', color: 'var(--color-accent)', ...ch(k.change.awaiting, true) },
    { label: 'Offers sent', value: fmt.num(k.off), onClick: q('offers'), ...ch(k.change.off) },
    { label: 'Offers accepted', value: fmt.num(k.acc), onClick: q('offers'), ...ch(k.change.acc) },
    { label: 'Cars purchased', value: fmt.num(k.pur), onClick: q('sales'), ...ch(k.change.pur) },
    { label: 'Purchase value', value: fmt.pesoShort(k.value), onClick: q('reports'), ...ch(k.change.value) },
    { label: 'Average purchase', value: fmt.peso(k.avg), onClick: q('reports'), ...ch(k.change.avg) },
    { label: 'Conversion rate', value: fmt.pct(k.conv), onClick: q('reports'), tip: 'Cars purchased ÷ cars submitted', ...ch(k.change.conv) },
  ].map(x => ({ color: 'var(--color-text)', tip: '', ...x }));
  const stages: [string, number, string][] = [['Submitted', k.sub, 'submissions'], ['Reviewed', k.rev, 'submissions'], ['Valuated', k.val, 'valuations'], ['Offers sent', k.off, 'offers'], ['Accepted', k.acc, 'inspections'], ['Purchased', k.pur, 'sales']];
  const sv = stages[stage], prev = stage ? stages[stage - 1] : null;
  const att = DA.attention();
  const attShown = att.filter(a => attn === 'All' || (attn === 'Urgent' ? a.hot : a.sev !== 'high'));
  const makes = Object.keys(MAKE_SHARE).map(m => ({ label: m, value: Math.round(k.sub * MAKE_SHARE[m][0]) + S.submissions.filter(s => s.live && DA.veh(s).make === m).length })).sort((a, b) => b.value - a.value).slice(0, 8);
  const sources = DA.sourceTable(range, custom).map(x => ({ label: x.name, value: x.subs })).sort((a, b) => b.value - a.value).slice(0, 8);
  const recent = S.submissions.slice().sort((a, b) => b.submitted - a.submitted).slice(0, 7);
  const activity = S.activity.slice().sort((a, b) => b.ts - a.ts).slice(0, 9);
  const attnTab = (kind: string) => /message/i.test(kind) ? 'messages' : /photo/i.test(kind) ? 'photos' : /valuation/i.test(kind) ? 'valuation' : /inspection/i.test(kind) ? 'inspection' : /payment/i.test(kind) ? 'sale' : /offer/i.test(kind) ? 'offers' : 'overview';

  return (
    <div style={sx('display:flex;flex-direction:column;gap:28px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
        <div>
          <h1 style={sx('font-size:34px;margin:0;letter-spacing:-0.02em')}>Dashboard</h1>
          <div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>{rangeLabel} · {rangeDates} · compared with the previous period</div>
        </div>
        <RangePicker />
      </div>

      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));border-top:2px solid var(--color-text);border-left:1px solid var(--color-divider)')}>
        {kpis.map(x => (
          <button key={x.label} onClick={x.onClick} title={x.tip} className="hover-surface-bg" style={sx('all:unset;box-sizing:border-box;cursor:pointer;padding:16px 18px 18px;border-right:1px solid var(--color-divider);border-bottom:1px solid var(--color-divider);display:flex;flex-direction:column;gap:6px;background:transparent')}>
            <span style={sx('font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700)')}>{x.label}</span>
            <span style={{ ...sx('font-weight:800;font-size:clamp(26px,2.4vw,34px);line-height:1.05;letter-spacing:-0.02em;font-variant-numeric:tabular-nums'), color: x.color }}>{x.value}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: x.chColor }}>{x.change} <span style={sx('font-weight:400;color:var(--color-neutral-700)')}>vs prev.</span></span>
          </button>
        ))}
      </div>

      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:28px')}>
        <section style={sx('display:flex;flex-direction:column;gap:14px')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-top:2px solid var(--color-text);padding-top:12px')}>
            <h3 style={sx('font-size:18px;margin:0')}>Acquisition funnel</h3>
            <span style={sx('font-size:12px;color:var(--color-neutral-700)')}>Click a stage for conversion</span>
          </div>
          <div style={sx('display:flex;flex-direction:column;gap:6px')}>
            {stages.map(([label, value], i) => {
              const ratio = value / k.sub, pct = Math.max(4, ratio * 100);
              return (
                <button key={label} onClick={() => setStage(i)} style={sx('all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) 96px;gap:12px;align-items:center')}>
                  <div style={sx('position:relative;height:40px;background:var(--color-neutral-200)')}>
                    <div style={{ ...sx('position:absolute;left:0;top:0;bottom:0'), width: pct + '%', background: i === stage ? 'var(--color-accent)' : 'var(--color-text)' }} />
                    <div style={{ ...sx('position:absolute;top:0;bottom:0;display:flex;align-items:center;gap:10px;font-weight:700;font-size:13.5px;white-space:nowrap'), left: ratio < 0.3 ? 'calc(' + pct + '% + 10px)' : '12px', color: ratio < 0.3 ? 'var(--color-text)' : 'var(--color-bg)' }}><span style={sx('font-weight:800;font-size:17px;font-variant-numeric:tabular-nums')}>{fmt.num(value)}</span>{label}</div>
                  </div>
                  <div style={sx('font-size:12px;text-align:right;color:var(--color-neutral-700);font-variant-numeric:tabular-nums')}>{i === 0 ? '100%' : (value / stages[i - 1][1] * 100).toFixed(1) + '% of prev.'}</div>
                </button>
              );
            })}
          </div>
          <div style={sx('background:var(--color-surface);padding:14px 16px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center')}>
            <div style={sx('font-size:13.5px')}><strong>{sv[0]}:</strong> {fmt.num(sv[1]) + ' cases · ' + (sv[1] / k.sub * 100).toFixed(1) + '% of submissions' + (prev ? ' · ' + fmt.num(prev[1] - sv[1]) + ' dropped after ' + prev[0].toLowerCase() : '')}</div>
            <button className="btn btn-ghost" onClick={q(sv[2])}>View cases →</button>
          </div>
        </section>

        <section style={sx('display:flex;flex-direction:column;gap:10px')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-top:6px solid var(--color-accent);padding-top:10px')}>
            <h3 style={sx('font-size:18px;margin:0')}>Needs attention <span style={sx('color:var(--color-accent-700)')}>{att.length}</span></h3>
            <div style={sx('display:flex;gap:4px')}>
              {['All', 'Urgent', 'Other'].map(x => <button key={x} onClick={() => setAttn(x)} style={{ ...sx('font:inherit;font-size:12px;padding:4px 8px;border:1px solid var(--color-divider);cursor:pointer'), background: attn === x ? 'var(--color-text)' : 'transparent', color: attn === x ? 'var(--color-bg)' : 'var(--color-text)' }}>{x}</button>)}
            </div>
          </div>
          <div style={sx('display:flex;flex-direction:column;max-height:420px;overflow:auto')}>
            {attShown.map((a, i) => (
              <button key={a.subId + a.kind + i} onClick={() => DA.openCase(a.subId, attnTab(a.kind))} className="hover-surface-bg" style={sx('all:unset;box-sizing:border-box;cursor:pointer;display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 8px 11px 0;border-bottom:1px solid var(--color-divider)')}>
                <span style={{ width: 8, alignSelf: 'stretch', background: a.sev === 'high' ? 'var(--color-accent)' : a.sev === 'med' ? 'var(--color-text)' : 'var(--color-neutral-400)' }} />
                <span style={sx('min-width:0')}><span style={sx('display:block;font-weight:700;font-size:13.5px')}>{a.kind}</span><span style={sx('display:block;font-size:12px;color:var(--color-neutral-700);white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>{a.ref} · {a.vehicle} · {a.detail}</span></span>
                <span style={sx('font-size:12px;font-weight:600;color:var(--color-accent-700)')}>Open →</span>
              </button>
            ))}
            {attShown.length === 0 && <div style={sx('padding:20px 0;font-size:13px;color:var(--color-neutral-700)')}>Nothing needs attention right now.</div>}
          </div>
        </section>
      </div>

      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px')}>
        <section style={sx('display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-text);padding-top:12px')}>
          <h3 style={sx('font-size:18px;margin:0')}>Submission trend</h3>
          <Chart type="bar" data={ser.map(x => ({ label: x.label, value: x.sub }))} unit="submissions" height={180} summaryLabel={rangeLabel} />
        </section>
        <section style={sx('display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-text);padding-top:12px')}>
          <h3 style={sx('font-size:18px;margin:0')}>Purchase value trend</h3>
          <Chart type="line" data={ser.map(x => ({ label: x.label, value: x.value }))} format="pesoShort" height={180} summaryLabel={rangeLabel} />
        </section>
      </div>

      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:28px')}>
        <section style={sx('display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-text);padding-top:12px')}>
          <h3 style={sx('font-size:18px;margin:0')}>Vehicle status breakdown</h3>
          <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>Open pipeline now · click to filter</div>
          <Chart type="hbar" data={DA.pipeline()} unit="cases" color="ink" onSelect={d => DA.go('admin', 'submissions', { status: d.label })} />
        </section>
        <section style={sx('display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-text);padding-top:12px')}>
          <h3 style={sx('font-size:18px;margin:0')}>Top vehicle makes</h3>
          <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>Submissions · {rangeLabel}</div>
          <Chart type="hbar" data={makes} unit="submitted" />
        </section>
        <section style={sx('display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-text);padding-top:12px')}>
          <h3 style={sx('font-size:18px;margin:0')}>Marketing sources</h3>
          <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>Submissions · {rangeLabel}</div>
          <Chart type="hbar" data={sources} unit="submissions" />
        </section>
      </div>

      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,480px),1fr));gap:28px')}>
        <section style={sx('display:flex;flex-direction:column;gap:10px')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--color-text);padding-top:12px')}><h3 style={sx('font-size:18px;margin:0')}>Recent submissions</h3><button className="btn btn-ghost" onClick={q('submissions')}>All submissions →</button></div>
          <div style={sx('overflow-x:auto')}>
            <table className="table" style={sx('font-size:13px')}>
              <thead><tr><th>Reference</th><th>Vehicle</th><th>Customer</th><th>Submitted</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map(s => {
                  const b = DA.badge(s.status);
                  return (
                    <tr key={s.id} onClick={() => DA.openCase(s.id)} style={sx('cursor:pointer')}>
                      <td style={sx('font-weight:700;white-space:nowrap')}>{s.ref}</td><td>{DA.vName(s)}</td><td>{DA.cust(s.customerId).name}</td><td style={sx('white-space:nowrap')}>{fmt.ago(s.submitted)}</td><td><span style={b.style}>{b.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section style={sx('display:flex;flex-direction:column;gap:10px')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--color-text);padding-top:12px')}><h3 style={sx('font-size:18px;margin:0')}>Recent activity</h3><button className="btn btn-ghost" onClick={q('logs')}>Activity log →</button></div>
          <div>
            {activity.map(a => (
              <div key={a.id} style={sx('display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider);font-size:13px')}>
                <span style={sx('color:var(--color-neutral-700);font-variant-numeric:tabular-nums')}>{fmt.ago(a.ts)}</span>
                <span><strong>{DA.staffName(a.user)}</strong> · {a.action} · <span style={sx('color:var(--color-neutral-800)')}>{a.record}</span> <span style={sx('color:var(--color-neutral-700)')}>{a.details}</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
