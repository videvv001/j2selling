import { useState } from 'react';
import { BRAND } from '../../config';
import { Chart, type ChartDatum, type ChartFormat } from '../../components/Chart';
import { sx } from '../../lib/sx';
import {
  ACTIVE, CITIES, DA, LOC_SHARE, MAKES, MAKE_SHARE, MODEL_SHARE, RANGE_LABEL, SOURCES, fmt, noise, now,
  type Range, type SourceRow,
} from '../../store';
import { currentRange } from './AdminDashboard';

type FilterKey = 'make' | 'model' | 'year' | 'location' | 'staff' | 'source';
type Filters = Record<FilterKey, string>;
type SrcKey = 'name' | 'leads' | 'subs' | 'offers' | 'acc' | 'pur' | 'conv' | 'value';
const EMPTY: Filters = { make: '', model: '', year: '', location: '', staff: '', source: '' };
const STAFF_SHARE: Record<string, number> = { 'John Reyes': .44, 'Andrea Cruz': .38, 'Carla Mendoza': .18 };
const YEAR_SHARE: Record<string, number> = { 2026: .01, 2025: .03, 2024: .06, 2023: .09, 2022: .15, 2021: .16, 2020: .17, 2019: .15, 2018: .09, 2017: .05, 2016: .04 };
const TABS: [string, string][] = [['sales', 'Sales & Purchases'], ['vehicles', 'Vehicle Analytics'], ['marketing', 'Marketing Attribution'], ['staff', 'Staff Performance']];
const SRC_COLS: [SrcKey, string, 'left' | 'right'][] = [['name', 'Source', 'left'], ['leads', 'Leads', 'right'], ['subs', 'Vehicle submissions', 'right'], ['offers', 'Offers', 'right'], ['acc', 'Accepted offers', 'right'], ['pur', 'Cars purchased', 'right'], ['conv', 'Lead → purchase', 'right'], ['value', 'Total purchase value', 'right']];

const tile = (k: string, v: string | number, color = 'var(--color-text)', sub?: string) => (
  <div key={k} style={sx('padding:12px 14px;border-right:1px solid var(--color-divider);border-bottom:1px solid var(--color-divider)')}>
    <div style={sx('font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700)')}>{k}</div>
    <div style={{ ...sx('font-weight:800;font-size:22px;font-variant-numeric:tabular-nums'), color }}>{v}</div>
    {sub && <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>{sub}</div>}
  </div>
);

/** Reports. Headline figures are sample baselines scaled by the active filters, plus live demo activity. */
export function AdminReports() {
  const S = DA.S;
  const [tab, setTab] = useState('sales');
  const [F, setFilters] = useState<Filters>(EMPTY);
  const [views, setViews] = useState<Record<string, 'chart' | 'table'>>({});
  const [srcSort, setSrcSort] = useState<{ key: SrcKey; dir: number }>({ key: 'pur', dir: -1 });
  const { range, custom } = currentRange();

  const staffList = S.staff.filter(x => ['Valuator', 'Manager'].includes(x.role));
  const locTotal = Object.values(LOC_SHARE).reduce((a, b) => a + b, 0);
  const srcQ = DA.sourceTable('quarter');
  const srcTot = srcQ.reduce((a, b) => a + b.subs, 0);
  // Scale factor: the share of volume matching the current filters.
  let k = 1;
  if (F.make) k *= MAKE_SHARE[F.make][0];
  if (F.model) {
    const m = MODEL_SHARE.find(x => x[0] === (F.make || '') + ' ' + F.model || x[0].endsWith(' ' + F.model));
    const makeShare = F.make ? MAKE_SHARE[F.make][0] : 1;
    k *= m ? m[1] / makeShare : 0.02 / makeShare;
  }
  if (F.year) k *= YEAR_SHARE[F.year] || .01;
  if (F.location) k *= LOC_SHARE[F.location] / locTotal;
  if (F.staff) k *= STAFF_SHARE[F.staff] || .1;
  if (F.source) k *= (srcQ.find(x => x.name === F.source)?.subs || 0) / srcTot;
  k = Math.min(1, k);
  const K = DA.kpis(range, custom);
  const sc = (n: number) => Math.round(n * k);
  const m = { sub: sc(K.sub), val: sc(K.val), off: sc(K.off), acc: sc(K.acc), pur: sc(K.pur), value: Math.round(K.value * k / 1000) * 1000, avg: 0 };
  m.avg = m.pur ? m.value / m.pur : 0;
  const ser = DA.series(range, custom);
  const accRate = fmt.pct(m.off ? m.acc / m.off * 100 : 0);
  const metrics: [string, string, boolean?][] = [['Cars submitted', fmt.num(m.sub)], ['Cars valuated', fmt.num(m.val)], ['Offers sent', fmt.num(m.off)], ['Offers accepted', fmt.num(m.acc)], ['Cars purchased', fmt.num(m.pur), true], ['Total purchase value', fmt.pesoShort(m.value), true], ['Average purchase value', fmt.peso(m.avg)], ['Offer acceptance rate', accRate], ['Submission → purchase', fmt.pct(m.sub ? m.pur / m.sub * 100 : 0)], ['Avg time to valuation', '4.6 h'], ['Avg time to purchase', '6.8 days'], ['Declined offers', fmt.num(sc(K.off * 0.31))], ['Cancelled deals', fmt.num(sc(K.acc * 0.08))]];
  const bucket = (fn: (x: typeof ser[number], i: number) => number) => ser.map((x, i) => ({ label: x.label, value: fn(x, i) }));
  const salesCharts: { title: string; type: 'bar' | 'line'; data: ChartDatum[]; format: ChartFormat; unit: string; sl?: string; sv?: string }[] = [
    { title: 'Submissions over time', type: 'bar', data: bucket(x => sc(x.sub)), format: 'num', unit: 'submitted' },
    { title: 'Purchases over time', type: 'bar', data: bucket(x => sc(x.pur)), format: 'num', unit: 'purchased' },
    { title: 'Purchase value over time', type: 'line', data: bucket(x => Math.round(x.value * k)), format: 'pesoShort', unit: '' },
    { title: 'Average purchase price', type: 'line', data: bucket(x => x.avg || 560000), format: 'peso', unit: '', sv: fmt.peso(m.avg) },
    { title: 'Offer acceptance rate', type: 'line', data: bucket((_, i) => 44 + noise(i, 7) * 18), format: 'pct', unit: '', sv: accRate, sl: 'Period average' },
    { title: 'Average time to valuation', type: 'bar', data: bucket((_, i) => 3.4 + noise(i, 11) * 2.6), format: 'hours', unit: '', sv: '4.6 h', sl: 'Period average' },
  ];
  const match = (s: typeof S.submissions[number]) => { const v = DA.veh(s); return (!F.make || v.make === F.make) && (!F.model || v.model === F.model) && (!F.year || String(v.year) === F.year) && (!F.location || s.location === F.location) && (!F.staff || DA.staffName(s.assignedTo) === F.staff) && (!F.source || s.source === F.source); };
  const purchases = S.submissions.filter(s => DA.saleOf(s.id) && match(s)).sort((a, b) => DA.saleOf(b.id)!.agreed - DA.saleOf(a.id)!.agreed);

  /* vehicle analytics */
  const makes = Object.keys(MAKE_SHARE);
  const byMake = (idx: number, tot: number) => makes.map(mk => ({ label: mk, value: Math.round(tot * MAKE_SHARE[mk][idx]) })).filter(x => !F.make || x.label === F.make).sort((a, b) => b.value - a.value);
  const models = (idx: 1 | 2, tot: number) => MODEL_SHARE.map(x => ({ label: x[0], value: Math.round(tot * x[idx]) })).filter(x => !F.make || x.label.startsWith(F.make)).sort((a, b) => b.value - a.value);
  const years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((y, i) => ({ label: String(y), value: Math.round(m.pur * [.04, .05, .09, .15, .17, .16, .15, .09, .06][i] / 0.96) }));
  const locs = Object.keys(LOC_SHARE).map(l => ({ label: l, value: Math.round(m.pur * LOC_SHARE[l] / locTotal) })).sort((a, b) => b.value - a.value);
  const vCards: { id: string; title: string; rows: ChartDatum[]; format: ChartFormat; unit: string; color: 'ink' | 'accent'; col: string; unitLabel?: string }[] = [
    { id: 'sm', title: 'Top submitted makes', rows: byMake(0, m.sub), format: 'num', unit: 'submitted', color: 'ink', col: 'Make' },
    { id: 'pm', title: 'Top purchased makes', rows: byMake(1, m.pur), format: 'num', unit: 'purchased', color: 'accent', col: 'Make' },
    { id: 'smo', title: 'Top submitted models', rows: models(1, m.sub), format: 'num', unit: 'submitted', color: 'ink', col: 'Model' },
    { id: 'pmo', title: 'Top purchased models', rows: models(2, m.pur), format: 'num', unit: 'purchased', color: 'accent', col: 'Model' },
    { id: 'ap', title: 'Average purchase price by make', rows: makes.map(mk => ({ label: mk, value: MAKE_SHARE[mk][2] })).sort((a, b) => b.value - a.value), format: 'peso', unit: '', color: 'ink', col: 'Make', unitLabel: 'Avg price' },
    { id: 'py', title: 'Purchases by model year', rows: years, format: 'num', unit: 'purchased', color: 'accent', col: 'Year' },
    { id: 'pl', title: 'Purchases by location', rows: locs, format: 'num', unit: 'purchased', color: 'ink', col: 'Location' },
  ];

  /* marketing */
  const makeK = F.make ? MAKE_SHARE[F.make][0] : 1;
  const srcAll: SourceRow[] = DA.sourceTable(range, custom).map(x => ({ ...x, leads: Math.round(x.leads * makeK), subs: Math.round(x.subs * makeK) })).filter(x => !F.source || x.name === F.source);
  const sorted = srcAll.slice().sort((a, b) => (a[srcSort.key] > b[srcSort.key] ? 1 : a[srcSort.key] < b[srcSort.key] ? -1 : 0) * srcSort.dir);
  const maxConv = Math.max(1, ...srcAll.map(x => x.conv));
  const tot = srcAll.reduce((a, x) => ({ leads: a.leads + x.leads, subs: a.subs + x.subs, offers: a.offers + x.offers, acc: a.acc + x.acc, pur: a.pur + x.pur, value: a.value + x.value }), { leads: 0, subs: 0, offers: 0, acc: 0, pur: 0, value: 0 });
  const top = sorted.slice().sort((a, b) => b.pur - a.pur).slice(0, 3);

  /* staff */
  const perf = DA.staffPerf(range === 'custom' ? 'month' : range).filter(x => !F.staff || x.name === F.staff);
  const maxLoad = Math.max(1, ...perf.map(x => x.pending));
  const attn = DA.attention();
  const unassigned = S.submissions.filter(s => !s.assignedTo && ACTIVE(s.status)).length;
  const flagsFor = (id: string, overdue: number) => {
    const mine = S.submissions.filter(s => s.assignedTo === id && ACTIVE(s.status));
    const oldest = mine.length ? Math.max(...mine.map(s => (now() - s.updated) / 3600e3)) : 0;
    const urgent = attn.filter(a => S.submissions.find(s => s.id === a.subId && s.assignedTo === id) && a.hot).length;
    return [urgent ? urgent + ' urgent' : '', overdue ? overdue + ' overdue inspection' : '', oldest > 72 ? 'oldest open ' + Math.floor(oldest / 24) + 'd' : ''].filter(Boolean).join(' · ') || '—';
  };

  const setF = (key: FilterKey) => (e: { target: { value: string } }) => { const v = e.target.value; setFilters(s => ({ ...s, [key]: v, ...(key === 'make' ? { model: '' } : {}) })); };
  const filters: [string, FilterKey, string[]][] = [['Make', 'make', makes], ['Model', 'model', F.make ? MAKES[F.make] : Array.from(new Set(Object.values(MAKES).flat()))], ['Year', 'year', ['2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016']], ['Location', 'location', CITIES], ['Staff', 'staff', staffList.map(x => x.name)], ['Marketing source', 'source', SOURCES]];
  const anyFilter = Object.values(F).some(Boolean);
  const scopeLine = RANGE_LABEL[range] + (anyFilter ? ' · filtered: ' + Object.values(F).filter(Boolean).join(', ') : ' · all vehicles') + ' · includes live demo activity';

  const exportCsv = () => {
    const rows: (string | number)[][] = tab === 'marketing' ? [SRC_COLS.map(c => c[1]) as (string | number)[]].concat(sorted.map(x => [x.name, x.leads, x.subs, x.offers, x.acc, x.pur, x.conv.toFixed(1), x.value]))
      : tab === 'staff' ? [['Staff', 'Role', 'Assigned', 'Pending', 'Valuations', 'Offers', 'Purchased', 'Response h', 'Value'] as (string | number)[]].concat(perf.map(x => [x.name, x.role, x.assigned, x.pending, x.valuations, x.offers, x.purchased, x.response, x.value]))
      : [['Metric', 'Value'] as (string | number)[]].concat(metrics.map(x => [x[0], x[1]]));
    const blob = new Blob([rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = BRAND.domain.split('.')[0] + '-' + tab + '-report.csv'; a.click();
    DA.toast('Report exported');
  };
  const viewOf = (id: string) => views[id] || 'chart';
  const segOn = (on: boolean) => ({ background: on ? 'var(--color-text)' : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-text)' });

  return (
    <div style={sx('display:flex;flex-direction:column;gap:20px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
        <div><h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Reports &amp; Analytics</h1><div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>{scopeLine}</div></div>
        <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}><button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button><button className="btn btn-secondary" onClick={() => window.print()}>Print</button></div>
      </div>
      <div role="tablist" style={sx('display:flex;overflow-x:auto;border-bottom:2px solid var(--color-divider)')}>
        {TABS.map(([kk, label]) => <button key={kk} onClick={() => setTab(kk)} style={{ ...sx('font:inherit;font-size:14px;padding:10px 14px;border:0;background:transparent;cursor:pointer;margin-bottom:-2px'), borderBottom: '3px solid ' + (tab === kk ? 'var(--color-accent)' : 'transparent'), color: tab === kk ? 'var(--color-text)' : 'var(--color-neutral-700)', fontWeight: tab === kk ? 800 : 400 }}>{label}</button>)}
      </div>
      <div style={sx('display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;background:var(--color-surface);padding:12px')}>
        <div className="field"><label>Date</label><select className="input" value={range} onChange={e => DA.setUI({ range: e.target.value as Range })} style={sx('min-height:34px')}>{(['today', 'week', 'month', 'quarter', 'year'] as Range[]).map(v => <option key={v} value={v}>{RANGE_LABEL[v]}</option>)}{range === 'custom' && <option value="custom">{RANGE_LABEL.custom}</option>}</select></div>
        {filters.map(([label, key, options]) => (
          <div key={key} className="field" style={sx('min-width:130px')}><label>{label}</label><select className="input" value={F[key]} onChange={setF(key)} style={sx('min-height:34px')}><option value="">All</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select></div>
        ))}
        {anyFilter && <button className="btn btn-ghost" onClick={() => setFilters(EMPTY)}>Clear</button>}
      </div>

      {tab === 'sales' && (
        <>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));border-top:2px solid var(--color-text);border-left:1px solid var(--color-divider)')}>
            {metrics.map(([kk, v, hot]) => tile(kk, v, hot ? 'var(--color-accent)' : 'var(--color-text)'))}
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px')}>
            {salesCharts.map(c => (
              <section key={c.title} style={sx('border-top:2px solid var(--color-text);padding-top:12px;display:flex;flex-direction:column;gap:8px')}><h3 style={sx('font-size:17px;margin:0')}>{c.title}</h3><Chart type={c.type} data={c.data} format={c.format} unit={c.unit} summaryLabel={c.sl || RANGE_LABEL[range]} summaryValue={c.sv} height={160} /></section>
            ))}
          </div>
          <section>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--color-text);padding-top:12px;margin-bottom:6px')}><h3 style={sx('font-size:17px;margin:0')}>Purchase records</h3><span style={sx('font-size:12px;color:var(--color-neutral-700)')}>{purchases.length} completed or in progress · click to open</span></div>
            <div style={sx('overflow-x:auto')}><table className="table" style={sx('font-size:13px;min-width:820px')}>
              <thead><tr><th>Reference</th><th>Vehicle</th><th>Customer</th><th>Location</th><th>Staff</th><th>Source</th><th>Agreed</th><th>Stage</th><th style={sx('text-align:right')}>Price</th></tr></thead>
              <tbody>{purchases.map(s => { const sl = DA.saleOf(s.id)!; return <tr key={s.id} onClick={() => DA.openCase(s.id, 'sale')} style={{ cursor: 'pointer', background: s.live ? 'var(--color-accent-100)' : 'transparent' }}><td style={sx('font-weight:700')}>{s.ref}</td><td>{DA.vName(s)}</td><td>{DA.cust(s.customerId).name}</td><td>{s.location}</td><td>{DA.staffName(s.assignedTo)}</td><td>{s.source}</td><td>{fmt.date(sl.agreed)}</td><td>{sl.stage}</td><td style={sx('text-align:right;font-weight:800')}>{fmt.peso(sl.price)}</td></tr>; })}</tbody>
            </table></div>
          </section>
        </>
      )}

      {tab === 'vehicles' && (
        <>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));border-top:2px solid var(--color-text);border-left:1px solid var(--color-divider)')}>
            {[['Average mileage', '52,840 km'], ['Average vehicle age', '5.8 years'], ['Most submitted', 'Toyota Vios'], ['Most purchased', 'Toyota Vios'], ['Highest avg price', 'Isuzu · ₱925K']].map(([kk, v]) => tile(kk, v))}
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:28px')}>
            {vCards.map(c => {
              const view = viewOf(c.id), total = c.rows.reduce((a, b) => a + b.value, 0) || 1;
              return (
                <section key={c.id} style={sx('border-top:2px solid var(--color-text);padding-top:12px;display:flex;flex-direction:column;gap:8px')}>
                  <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:8px')}><h3 style={sx('font-size:17px;margin:0')}>{c.title}</h3>
                    <div style={sx('display:flex;border:1px solid var(--color-divider)')}>
                      <button onClick={() => setViews(v => ({ ...v, [c.id]: 'chart' }))} style={{ ...sx('font:inherit;font-size:11.5px;padding:3px 8px;border:0;cursor:pointer'), ...segOn(view === 'chart') }}>Chart</button>
                      <button onClick={() => setViews(v => ({ ...v, [c.id]: 'table' }))} style={{ ...sx('font:inherit;font-size:11.5px;padding:3px 8px;border:0;cursor:pointer'), ...segOn(view === 'table') }}>Table</button>
                    </div>
                  </div>
                  {view === 'chart' ? <Chart type="hbar" data={c.rows} format={c.format} unit={c.unit} color={c.color} /> : (
                    <table className="table" style={sx('font-size:13px')}><thead><tr><th>{c.col}</th><th style={sx('text-align:right')}>{c.unitLabel || 'Count'}</th><th style={sx('text-align:right')}>Share</th></tr></thead>
                      <tbody>{c.rows.map(r => <tr key={r.label}><td>{r.label}</td><td style={sx('text-align:right;font-weight:700')}>{c.format === 'peso' ? fmt.peso(r.value) : c.format === 'pesoShort' ? fmt.pesoShort(r.value) : fmt.num(r.value)}</td><td style={sx('text-align:right;color:var(--color-neutral-700)')}>{c.format === 'peso' ? '—' : (r.value / total * 100).toFixed(1) + '%'}</td></tr>)}</tbody></table>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {tab === 'marketing' && (
        <>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px')}>
            {top.map((x, i) => (
              <div key={x.name} style={{ ...sx('background:var(--color-surface);padding:16px;display:flex;flex-direction:column;gap:8px'), borderTop: '6px solid ' + (i === 0 ? 'var(--color-accent)' : 'var(--color-text)') }}>
                <div style={sx('font-weight:800;font-size:18px')}>{x.name}</div>
                <div style={sx('display:grid;grid-template-columns:repeat(2,1fr);gap:6px 12px;font-size:13px')}>
                  {[['Leads', fmt.num(x.leads)], ['Vehicle submissions', fmt.num(x.subs)], ['Offers', fmt.num(x.offers)], ['Cars purchased', fmt.num(x.pur)], ['Lead → purchase', fmt.pct(x.conv)], ['Purchase value', fmt.pesoShort(x.value)]].map(([kk, v]) => <span key={kk} style={{ display: 'contents' }}><span style={sx('color:var(--color-neutral-700)')}>{kk}</span><strong style={sx('text-align:right;font-variant-numeric:tabular-nums')}>{v}</strong></span>)}
                </div>
              </div>
            ))}
          </div>
          <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}><table className="table" style={sx('font-size:13px;min-width:860px')}>
            <thead><tr>{SRC_COLS.map(([key, label, align]) => <th key={key} onClick={() => setSrcSort({ key, dir: srcSort.key === key ? -srcSort.dir : -1 })} style={{ cursor: 'pointer', textAlign: align, whiteSpace: 'nowrap' }}>{label} {srcSort.key === key ? (srcSort.dir > 0 ? '↑' : '↓') : ''}</th>)}</tr></thead>
            <tbody>{sorted.map(x => (
              <tr key={x.name}><td style={sx('font-weight:700')}>{x.name}</td><td style={sx('text-align:right')}>{fmt.num(x.leads)}</td><td style={sx('text-align:right')}>{fmt.num(x.subs)}</td><td style={sx('text-align:right')}>{fmt.num(x.offers)}</td><td style={sx('text-align:right')}>{fmt.num(x.acc)}</td><td style={sx('text-align:right;font-weight:700')}>{fmt.num(x.pur)}</td><td style={sx('text-align:right')}><div style={sx('display:flex;gap:8px;align-items:center;justify-content:flex-end')}><div style={sx('width:60px;height:6px;background:var(--color-neutral-200)')}><div style={{ height: '100%', width: (x.conv / maxConv * 100) + '%', background: 'var(--color-accent)' }} /></div>{fmt.pct(x.conv)}</div></td><td style={sx('text-align:right;font-weight:800')}>{fmt.peso(x.value)}</td></tr>
            ))}</tbody>
            <tfoot><tr>{[['Total', 'left'], [fmt.num(tot.leads)], [fmt.num(tot.subs)], [fmt.num(tot.offers)], [fmt.num(tot.acc)], [fmt.num(tot.pur)], [fmt.pct(tot.leads ? tot.pur / tot.leads * 100 : 0)], [fmt.peso(tot.value)]].map(([v, a], i) => <td key={i} style={{ fontWeight: 800, textAlign: (a || 'right') as 'left' | 'right', borderTop: '2px solid var(--color-text)' }}>{v}</td>)}</tr></tfoot>
          </table></div>
          <section style={sx('border-top:2px solid var(--color-text);padding-top:12px;display:flex;flex-direction:column;gap:8px;max-width:760px')}><h3 style={sx('font-size:17px;margin:0')}>Lead-to-purchase conversion by source</h3><Chart type="hbar" data={srcAll.map(x => ({ label: x.name, value: x.conv })).sort((a, b) => b.value - a.value)} format="pct" /></section>
        </>
      )}

      {tab === 'staff' && (
        <>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));border-top:2px solid var(--color-text);border-left:1px solid var(--color-divider)')}>
            {tile('Open cases', perf.reduce((a, x) => a + x.pending, 0), 'var(--color-text)', 'across ' + perf.length + ' people')}
            {tile('Unassigned', unassigned, unassigned ? 'var(--color-accent)' : 'var(--color-text)', 'need an owner')}
            {tile('Avg first response', '1.7 h', 'var(--color-text)', 'target < 2 h')}
            {tile('Avg time to valuation', '4.6 h', 'var(--color-text)', 'target < 6 h')}
            {tile('Urgent items', attn.filter(a => a.hot).length, 'var(--color-accent)', 'from Needs Attention')}
          </div>
          <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}><table className="table" style={sx('font-size:13px;min-width:1040px')}>
            <thead><tr><th>Staff</th><th>Role</th><th style={sx('text-align:right')}>Assigned</th><th>Open workload</th><th style={sx('text-align:right')}>Valuations</th><th style={sx('text-align:right')}>Offers sent</th><th style={sx('text-align:right')}>Purchased</th><th style={sx('text-align:right')}>Avg response</th><th style={sx('text-align:right')}>Time to valuation</th><th style={sx('text-align:right')}>Purchase value</th><th>Flags</th><th></th></tr></thead>
            <tbody>{perf.map(x => (
              <tr key={x.id}>
                <td style={sx('font-weight:700;white-space:nowrap')}>{x.name}</td><td>{x.role}</td><td style={sx('text-align:right')}>{x.assigned}</td>
                <td><div style={sx('display:flex;gap:8px;align-items:center')}><div style={sx('width:90px;height:8px;background:var(--color-neutral-200)')}><div style={{ height: '100%', width: (x.pending / maxLoad * 100) + '%', background: x.pending / maxLoad > 0.8 ? 'var(--color-accent)' : 'var(--color-text)' }} /></div><span style={sx('font-weight:700')}>{x.pending}</span></div></td>
                <td style={sx('text-align:right')}>{x.valuations || '—'}</td><td style={sx('text-align:right')}>{x.offers || '—'}</td><td style={sx('text-align:right;font-weight:700')}>{x.purchased || '—'}</td>
                <td style={{ textAlign: 'right', color: x.response > 2 ? 'var(--color-accent-700)' : 'inherit', fontWeight: 600 }}>{x.response.toFixed(1) + ' h'}</td><td style={sx('text-align:right')}>{x.ttv ? x.ttv.toFixed(1) + ' h' : '—'}</td><td style={sx('text-align:right;font-weight:800')}>{x.value ? fmt.pesoShort(x.value) : '—'}</td>
                <td style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600')}>{flagsFor(x.id, x.overdue)}</td>
                <td><button className="btn btn-ghost" onClick={() => DA.go('admin', 'submissions', { staff: x.name })} style={sx('font-size:12px')}>Queue →</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:28px')}>
            <section style={sx('border-top:2px solid var(--color-text);padding-top:12px;display:flex;flex-direction:column;gap:8px')}><h3 style={sx('font-size:17px;margin:0')}>Open cases per person</h3><Chart type="hbar" data={perf.map(x => ({ label: x.name, value: x.pending }))} unit="open" color="ink" /></section>
            <section style={sx('border-top:2px solid var(--color-text);padding-top:12px;display:flex;flex-direction:column;gap:8px')}><h3 style={sx('font-size:17px;margin:0')}>Average response time (hours)</h3><Chart type="hbar" data={perf.map(x => ({ label: x.name, value: x.response }))} format="hours" /></section>
          </div>
        </>
      )}
    </div>
  );
}
