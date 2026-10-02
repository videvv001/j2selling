import { useState, type CSSProperties } from 'react';
import { sx } from '../../lib/sx';
import {
  ACTIVE, CITIES, DA, MAKES, SOURCES, STATUS_ORDER, fmt, now, ts, type Status, type Submission,
} from '../../store';

type View = 'submissions' | 'valuations' | 'offers' | 'inspections' | 'sales';
type RangeKey = 'year' | 'date' | 'offer' | 'price';
interface ViewState {
  q: string; statuses: string[]; quick: string; make: string; model: string; staff: string; location: string; source: string;
  yearMin: string; yearMax: string; dateMin: string; dateMax: string; offerMin: string; offerMax: string; priceMin: string; priceMax: string;
  sort: { key: string; dir: number }; page: number; per: number; hidden: string[]; _status?: string; _staff?: string;
}
interface Cell { text?: string; sub?: string; weight?: number; ws?: string; color?: string; badge?: { label: string; style: CSSProperties } }
type Col = [string, (s: Submission) => string | number, (s: Submission) => Cell];
type Quick = [string, string, (s: Submission) => boolean];

const DAY_MS = 86400e3;

const COLS: Record<string, Col> = {
  ref: ['Reference', s => s.ref, s => ({ text: s.ref, weight: 700, ws: 'nowrap' })],
  vehicle: ['Vehicle', s => DA.vName(s), s => { const v = DA.veh(s); return { text: v.make + ' ' + v.model + ' ' + v.year, sub: v.plate + ' · ' + v.variant, ws: 'nowrap' }; }],
  customer: ['Customer', s => DA.cust(s.customerId).name, s => ({ text: DA.cust(s.customerId).name, sub: DA.cust(s.customerId).phone, ws: 'nowrap' })],
  submitted: ['Date Submitted', s => s.submitted, s => ({ text: fmt.date(s.submitted), sub: fmt.ago(s.submitted), ws: 'nowrap' })],
  mileage: ['Mileage', s => DA.veh(s).mileage, s => ({ text: fmt.km(DA.veh(s).mileage), ws: 'nowrap' })],
  location: ['Location', s => s.location, s => ({ text: s.location, ws: 'nowrap' })],
  staff: ['Assigned Staff', s => DA.staffName(s.assignedTo), s => ({ text: s.assignedTo ? DA.staffName(s.assignedTo) : 'Unassigned', color: s.assignedTo ? 'inherit' : 'var(--color-accent-700)', ws: 'nowrap' })],
  offer: ['Offer', s => DA.currentOffer(s.id)?.amount || 0, s => { const o = DA.currentOffer(s.id); return { text: o ? fmt.peso(o.amount) : '—', sub: o ? o.type : '', weight: 700, ws: 'nowrap' }; }],
  source: ['Source', s => s.source, s => ({ text: s.source, ws: 'nowrap' })],
  status: ['Status', s => STATUS_ORDER.indexOf(s.status), s => ({ badge: DA.badge(s.status) })],
  age: ['Waiting', s => -s.updated, s => { const h = (now() - s.updated) / 3600e3; return { text: h < 48 ? Math.floor(h) + 'h' : Math.floor(h / 24) + 'd', color: h > DA.S.settings.attentionHours && ['Submitted', 'Under Review'].includes(s.status) ? 'var(--color-accent-700)' : 'inherit', weight: 700 }; }],
  valuation: ['Valuation', s => DA.valuationOf(s.id)?.offer || 0, s => { const v = DA.valuationOf(s.id); return { text: v ? fmt.peso(v.offer) : 'Not started', sub: v ? v.status + ' · ' + DA.staffName(v.by) : '', weight: v ? 700 : 400 }; }],
  market: ['Market value', s => DA.valuationOf(s.id)?.market || 0, s => { const v = DA.valuationOf(s.id); return { text: v ? fmt.peso(v.market) : '—', ws: 'nowrap' }; }],
  offerSent: ['Sent', s => DA.currentOffer(s.id)?.ts || 0, s => { const o = DA.currentOffer(s.id); return { text: o ? fmt.date(o.ts) : '—', ws: 'nowrap' }; }],
  expires: ['Expires', s => DA.currentOffer(s.id)?.expires || 0, s => { const o = DA.currentOffer(s.id); const soon = !!o && o.status === 'Pending' && o.expires - now() < 2 * DAY_MS; return { text: o ? fmt.date(o.expires) : '—', color: soon ? 'var(--color-accent-700)' : 'inherit', weight: soon ? 700 : 400, ws: 'nowrap' }; }],
  offerStatus: ['Offer status', s => DA.currentOffer(s.id)?.status || '', s => { const o = DA.currentOffer(s.id); return { text: o ? o.status : '—', sub: o ? DA.offersOf(s.id).length + ' in history' : '' }; }],
  insDate: ['Inspection', s => DA.inspectionOf(s.id)?.ts || 0, s => { const i = DA.inspectionOf(s.id); return { text: i && i.date ? fmt.date(ts(i.date)) + ' · ' + i.time : 'Not Scheduled', sub: i ? i.location : '', color: i ? 'inherit' : 'var(--color-accent-700)' }; }],
  inspector: ['Inspector', s => { const i = DA.inspectionOf(s.id); return i ? DA.staffName(i.inspector) : ''; }, s => { const i = DA.inspectionOf(s.id); return { text: i ? DA.staffName(i.inspector) : '—', ws: 'nowrap' }; }],
  insStatus: ['Inspection status', s => DA.inspectionOf(s.id)?.status || '', s => { const i = DA.inspectionOf(s.id); return { text: i ? i.status : 'Not Scheduled', weight: 700 }; }],
  price: ['Purchase price', s => DA.saleOf(s.id)?.price || 0, s => { const sl = DA.saleOf(s.id); return { text: sl ? fmt.peso(sl.price) : '—', weight: 700, ws: 'nowrap' }; }],
  agreed: ['Agreed', s => DA.saleOf(s.id)?.agreed || 0, s => { const sl = DA.saleOf(s.id); return { text: sl ? fmt.date(sl.agreed) : '—', ws: 'nowrap' }; }],
  stage: ['Purchase stage', s => DA.saleOf(s.id)?.stage || '', s => { const sl = DA.saleOf(s.id); return { text: sl ? sl.stage : '—', weight: 700 }; }],
  payment: ['Payment', () => '', s => { const sl = DA.saleOf(s.id); const p = sl && DA.S.payments.find(x => x.saleId === sl.id); return { text: p ? p.status : 'Not started', sub: p ? p.reference : '' }; }],
};
const COL_KEYS: Record<View, string[]> = {
  submissions: ['ref', 'vehicle', 'customer', 'submitted', 'mileage', 'location', 'staff', 'offer', 'source', 'status'],
  valuations: ['ref', 'vehicle', 'customer', 'submitted', 'age', 'staff', 'market', 'valuation', 'status'],
  offers: ['ref', 'vehicle', 'customer', 'offer', 'offerSent', 'expires', 'offerStatus', 'staff', 'status'],
  inspections: ['ref', 'vehicle', 'customer', 'insDate', 'inspector', 'insStatus', 'offer', 'status'],
  sales: ['ref', 'vehicle', 'customer', 'price', 'agreed', 'stage', 'payment', 'staff', 'status'],
};
const RANGES: [string, RangeKey, string, string, string][] = [['Year', 'year', 'number', '2015', '2026'], ['Date submitted', 'date', 'date', '', ''], ['Offer range (₱)', 'offer', 'number', 'min', 'max'], ['Purchase price (₱)', 'price', 'number', 'min', 'max']];
const SELECTS: [string, 'make' | 'model' | 'staff' | 'location' | 'source'][] = [['Make', 'make'], ['Model', 'model'], ['Assigned staff', 'staff'], ['Location', 'location'], ['Marketing source', 'source']];

function config(view: View): { title: string; sub: string; statuses: Status[] | null; quick: Quick[] } {
  const me = DA.S.session.adminId;
  switch (view) {
    case 'valuations': return { title: 'Valuations', sub: 'Cases waiting for or holding a valuation', statuses: ['Submitted', 'Under Review', 'More Information Required', 'Valuation In Progress', 'Valuated'], quick: [['all', 'All', () => true], ['approve', 'Awaiting approval', s => DA.valuationOf(s.id)?.status === 'Draft'], ['todo', 'Not started', s => !DA.valuationOf(s.id)], ['mine', 'Mine', s => s.assignedTo === me]] };
    case 'offers': return { title: 'Offers', sub: 'Open offers and negotiations. Offer history is never overwritten.', statuses: ['Offer Sent', 'Negotiating', 'Offer Accepted', 'Final Offer', 'Customer Declined', 'Expired'], quick: [['all', 'All', () => true], ['pending', 'Awaiting customer', s => ['Offer Sent', 'Final Offer'].includes(s.status)], ['neg', 'Negotiating', s => s.status === 'Negotiating'], ['exp', 'Expiring < 48h', s => { const o = DA.currentOffer(s.id); return !!o && o.status === 'Pending' && o.expires - now() < 2 * DAY_MS; }]] };
    case 'inspections': return { title: 'Inspections', sub: 'Schedule, run and complete vehicle inspections', statuses: ['Offer Accepted', 'Inspection Scheduled', 'Inspection Completed', 'Final Offer'], quick: [['all', 'All', () => true], ['ns', 'Not scheduled', s => s.status === 'Offer Accepted'], ['sch', 'Scheduled', s => s.status === 'Inspection Scheduled'], ['done', 'Completed', s => s.status === 'Inspection Completed' || s.status === 'Final Offer']] };
    case 'sales': return { title: 'Sales / Purchases', sub: 'Agreed sales through payment and vehicle handover', statuses: ['Sale Agreed', 'Payment Processing', 'Purchased'], quick: [['all', 'All', () => true], ['docs', 'Documents pending', s => s.status === 'Sale Agreed'], ['pay', 'Payment processing', s => s.status === 'Payment Processing'], ['done', 'Purchased', s => s.status === 'Purchased']] };
    default: return { title: 'Vehicle Submissions', sub: 'Every car submitted for valuation', statuses: null, quick: [['all', 'All', () => true], ['new', 'New', s => s.status === 'Submitted'], ['active', 'Open', s => ACTIVE(s.status)], ['mine', 'Assigned to me', s => s.assignedTo === me], ['unassigned', 'Unassigned', s => !s.assignedTo], ['closed', 'Closed', s => !ACTIVE(s.status)]] };
  }
}

/** Work queues: one filterable, sortable table per pipeline stage. Filters are kept per queue. */
export function AdminSubmissions({ view: viewProp }: { view: string }) {
  const S = DA.S, params = S.route.params;
  const view = (viewProp || 'submissions') as View;
  const [byView, setByView] = useState<Partial<Record<View, ViewState>>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);

  // A status/staff filter in the URL (e.g. from a dashboard chart) resets this queue's filters.
  const vs = (): ViewState => {
    const cur = byView[view];
    if (cur && (!params.status || cur._status === params.status) && (!params.staff || cur._staff === params.staff)) return cur;
    return { q: '', statuses: params.status ? [params.status] : [], quick: 'all', make: '', model: '', staff: params.staff || '', location: '', source: '', yearMin: '', yearMax: '', dateMin: '', dateMax: '', offerMin: '', offerMax: '', priceMin: '', priceMax: '', sort: { key: 'submitted', dir: -1 }, page: 0, per: 10, hidden: [], _status: params.status, _staff: params.staff };
  };
  const st = vs();
  const set = (patch: Partial<ViewState>) => setByView(b => ({ ...b, [view]: { ...st, ...patch, ...(patch.page === undefined && !patch.sort ? { page: 0 } : {}) } }));

  const cfg = config(view);
  const base = S.submissions.filter(s => !cfg.statuses || cfg.statuses.includes(s.status));
  const q = st.q.trim().toLowerCase();
  const inR = (val: number, a: string, b: string) => (a === '' || val >= +a) && (b === '' || val <= +b);
  const quickFn = (cfg.quick.find(x => x[0] === st.quick) || cfg.quick[0])[2];
  let list = base.filter(s => {
    const v = DA.veh(s), c = DA.cust(s.customerId), o = DA.currentOffer(s.id), sl = DA.saleOf(s.id);
    if (q && ![s.ref, v.plate, v.make, v.model, c.name, c.email, c.phone, c.phone.replace(/\s/g, '')].join(' ').toLowerCase().includes(q)) return false;
    if (st.statuses.length && !st.statuses.includes(s.status)) return false;
    if (st.make && v.make !== st.make) return false;
    if (st.model && v.model !== st.model) return false;
    if (st.staff && DA.staffName(s.assignedTo) !== st.staff) return false;
    if (st.location && s.location !== st.location) return false;
    if (st.source && s.source !== st.source) return false;
    if (!inR(v.year, st.yearMin, st.yearMax)) return false;
    if (st.dateMin && s.submitted < Date.parse(st.dateMin)) return false;
    if (st.dateMax && s.submitted > Date.parse(st.dateMax) + DAY_MS) return false;
    if ((st.offerMin !== '' || st.offerMax !== '') && !(o && inR(o.amount, st.offerMin, st.offerMax))) return false;
    if ((st.priceMin !== '' || st.priceMax !== '') && !(sl && inR(sl.price, st.priceMin, st.priceMax))) return false;
    return quickFn(s);
  });
  const colKeys = COL_KEYS[view];
  const shown = colKeys.filter(k => !st.hidden.includes(k));
  const sk = COLS[st.sort.key] ? st.sort.key : 'submitted', dir = st.sort.dir;
  list = list.slice().sort((a, b) => { const x = COLS[sk][1](a), y = COLS[sk][1](b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
  const total = list.length, per = st.per, pages = Math.max(1, Math.ceil(total / per)), page = Math.min(st.page, pages - 1);
  const pageRows = list.slice(page * per, page * per + per);
  const toggleSel = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.concat(id));
  const opts: Record<string, string[]> = { make: Object.keys(MAKES), model: st.make ? MAKES[st.make] : Array.from(new Set(S.vehicles.map(v => v.model))).sort(), staff: S.staff.filter(x => ['Valuator', 'Manager', 'Inspector'].includes(x.role)).map(x => x.name), location: CITIES, source: SOURCES };
  const chips: { label: string; remove: () => void }[] = [];
  st.statuses.forEach(x => chips.push({ label: 'Status: ' + x, remove: () => set({ statuses: st.statuses.filter(y => y !== x) }) }));
  ([['make', 'Make'], ['model', 'Model'], ['staff', 'Staff'], ['location', 'Location'], ['source', 'Source']] as const).forEach(([k, l]) => { if (st[k]) chips.push({ label: l + ': ' + st[k], remove: () => set({ [k]: '' }) }); });
  RANGES.forEach(([l, k]) => {
    const mn = st[`${k}Min`], mx = st[`${k}Max`];
    if (mn !== '' || mx !== '') chips.push({ label: l + ': ' + (mn || '…') + ' – ' + (mx || '…'), remove: () => set({ [`${k}Min`]: '', [`${k}Max`]: '' }) });
  });
  const avail = cfg.statuses || STATUS_ORDER.filter(x => x !== 'Draft');
  const clearAll = () => set({ statuses: [], make: '', model: '', staff: '', location: '', source: '', yearMin: '', yearMax: '', dateMin: '', dateMax: '', offerMin: '', offerMax: '', priceMin: '', priceMax: '', q: '', quick: 'all' });
  const cellOf = (k: string, s: Submission): Cell => ({ ws: 'normal', weight: 400, color: 'inherit', sub: '', ...COLS[k][2](s) });
  const exportCsv = () => {
    const head = shown.map(k => COLS[k][0]);
    const lines = [head.join(',')].concat(list.map(s => shown.map(k => { const c = COLS[k][2](s); return '"' + String(c.badge ? c.badge.label : c.text).replace(/"/g, '""') + '"'; }).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = view + '-' + fmt.iso(now()) + '.csv'; a.click();
    DA.toast('Exported ' + list.length + ' rows');
  };
  const allSel = pageRows.length > 0 && pageRows.every(s => sel.includes(s.id));
  const toggleAll = () => { const ids = pageRows.map(s => s.id); const all = ids.every(id => sel.includes(id)); setSel(all ? sel.filter(x => !ids.includes(x)) : Array.from(new Set(sel.concat(ids)))); };
  const bulkAssign = (id: string) => { if (!id) return; sel.forEach(sid => DA.assign(sid, id)); DA.toast(sel.length + ' case' + (sel.length > 1 ? 's' : '') + ' assigned to ' + DA.staffName(id)); setSel([]); };
  const toggleBtn = (on: boolean): CSSProperties => ({ border: '1px solid ' + (on ? 'var(--color-text)' : 'var(--color-divider)'), background: on ? 'var(--color-text)' : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-text)' });

  return (
    <div style={sx('display:flex;flex-direction:column;gap:16px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
        <div style={sx('flex:1;min-width:260px')}>
          <h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>{cfg.title}</h1>
          <div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>{cfg.sub + ' · ' + base.length + ' cases'}</div>
        </div>
        <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
          <button className="btn btn-secondary" onClick={exportCsv}>Export CSV</button>
          {view === 'submissions' && <button className="btn btn-secondary" onClick={() => setColsOpen(o => !o)}>Columns</button>}
        </div>
      </div>
      {colsOpen && (
        <div style={sx('display:flex;flex-wrap:wrap;gap:6px;padding:12px;background:var(--color-surface)')}>
          {colKeys.map(k => {
            const on = !st.hidden.includes(k);
            return <button key={k} onClick={() => set({ hidden: on ? st.hidden.concat(k) : st.hidden.filter(x => x !== k) })} style={{ ...sx('font:inherit;font-size:12.5px;padding:5px 10px;cursor:pointer'), border: '1px solid ' + (on ? 'var(--color-text)' : 'var(--color-divider)'), background: on ? 'var(--color-bg)' : 'transparent', color: on ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>{on ? '✓' : '○'} {COLS[k][0]}</button>;
          })}
        </div>
      )}
      <div style={sx('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
        <input className="input" value={st.q} onChange={e => set({ q: e.target.value })} placeholder="Search reference, plate, customer, phone…" style={sx('max-width:340px;min-height:38px')} />
        <button className="btn btn-secondary" onClick={() => setFiltersOpen(o => !o)} style={sx('gap:8px')}>Filters{chips.length > 0 && <span style={sx('background:var(--color-accent-700);color:#fff;font-size:11px;padding:1px 6px')}>{chips.length}</span>}</button>
        <div style={sx('display:flex;flex-wrap:wrap;gap:4px')}>
          {cfg.quick.map(([k, l, fn]) => <button key={k} onClick={() => set({ quick: k })} style={{ ...sx('font:inherit;font-size:12.5px;padding:6px 10px;cursor:pointer;border:1px solid var(--color-divider)'), background: st.quick === k ? 'var(--color-text)' : 'transparent', color: st.quick === k ? 'var(--color-bg)' : 'var(--color-text)' }}>{l} <span style={sx('opacity:.7')}>{base.filter(fn).length}</span></button>)}
        </div>
      </div>
      {filtersOpen && (
        <div style={sx('border:2px solid var(--color-text);padding:16px;display:flex;flex-direction:column;gap:14px')}>
          <div className="field"><label>Status</label>
            <div style={sx('display:flex;flex-wrap:wrap;gap:4px')}>
              {avail.map(x => { const on = st.statuses.includes(x); return <button key={x} onClick={() => set({ statuses: on ? st.statuses.filter(y => y !== x) : st.statuses.concat(x) })} style={{ ...sx('font:inherit;font-size:12px;padding:4px 8px;cursor:pointer'), ...toggleBtn(on) }}>{x}</button>; })}
            </div>
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px')}>
            {SELECTS.map(([label, k]) => (
              <div key={k} className="field"><label>{label}</label>
                <select className="input" value={st[k]} onChange={e => set({ [k]: e.target.value, ...(k === 'make' ? { model: '' } : {}) })}><option value="">Any</option>{opts[k].map(o => <option key={o} value={o}>{o}</option>)}</select>
              </div>
            ))}
            {RANGES.map(([label, k, type, a, b]) => (
              <div key={k} className="field"><label>{label}</label>
                <div style={sx('display:flex;gap:4px;align-items:center')}>
                  <input className="input" type={type} value={st[`${k}Min`]} onChange={e => set({ [`${k}Min`]: e.target.value })} placeholder={a} style={sx('min-width:0')} /><span>–</span>
                  <input className="input" type={type} value={st[`${k}Max`]} onChange={e => set({ [`${k}Max`]: e.target.value })} placeholder={b} style={sx('min-width:0')} />
                </div>
              </div>
            ))}
          </div>
          <div style={sx('display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap')}><button className="btn btn-ghost" onClick={clearAll}>Clear all filters</button><button className="btn btn-primary" onClick={() => setFiltersOpen(false)}>Show {total} results</button></div>
        </div>
      )}
      {chips.length > 0 && (
        <div style={sx('display:flex;flex-wrap:wrap;gap:6px;align-items:center')}>
          {chips.map(c => <button key={c.label} onClick={c.remove} style={sx('font:inherit;font-size:12px;padding:4px 8px;border:0;background:var(--color-accent-100);color:var(--color-accent-800);cursor:pointer')}>{c.label} ×</button>)}
          <button className="btn btn-ghost" onClick={clearAll} style={sx('font-size:12px')}>Clear</button>
        </div>
      )}
      {sel.length > 0 && (
        <div style={sx('display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--color-text);color:var(--color-bg);padding:8px 12px;font-size:13px')}>
          <strong>{sel.length} selected</strong>
          <select value="" onChange={e => bulkAssign(e.target.value)} style={sx('font:inherit;font-size:13px;padding:4px 6px')}><option value="">Assign to…</option>{S.staff.filter(x => ['Valuator', 'Manager'].includes(x.role)).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <button onClick={() => setSel([])} style={sx('font:inherit;font-size:13px;background:transparent;border:0;color:var(--color-bg);text-decoration:underline;cursor:pointer')}>Clear selection</button>
        </div>
      )}
      <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}>
        <table className="table" style={sx('font-size:13px;min-width:1100px')}>
          <thead>
            <tr>
              <th style={sx('width:32px')}><input type="checkbox" checked={allSel} onChange={toggleAll} style={sx('accent-color:var(--color-accent)')} aria-label="Select page" /></th>
              {shown.map(k => <th key={k} onClick={() => set({ sort: { key: k, dir: sk === k ? -dir : 1 } })} style={{ ...sx('cursor:pointer;white-space:nowrap;user-select:none'), color: sk === k ? 'var(--color-text)' : 'inherit' }}>{COLS[k][0]} {sk === k ? (dir > 0 ? '↑' : '↓') : ''}</th>)}
              <th style={sx('text-align:right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(s => {
              const na = DA.nextAction(s), on = sel.includes(s.id);
              return (
                <tr key={s.id} onClick={() => DA.openCase(s.id)} style={{ cursor: 'pointer', background: on ? 'var(--color-accent-100)' : 'transparent' }}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={on} onChange={() => toggleSel(s.id)} style={sx('accent-color:var(--color-accent)')} aria-label="Select row" /></td>
                  {shown.map(k => {
                    const c = cellOf(k, s);
                    return (
                      <td key={k} style={{ whiteSpace: c.ws as CSSProperties['whiteSpace'], fontWeight: c.weight, fontVariantNumeric: 'tabular-nums', color: c.color }}>
                        {c.badge ? <span style={c.badge.style}>{c.badge.label}</span> : <>{c.text}{c.sub && <div style={sx('font-size:11.5px;font-weight:400;color:var(--color-neutral-700)')}>{c.sub}</div>}</>}
                      </td>
                    );
                  })}
                  <td style={sx('text-align:right;white-space:nowrap')} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost" onClick={() => DA.openCase(s.id, na.tab)} style={sx('font-size:12px;padding:4px 6px')}>{na.label}</button>
                    <button className="btn btn-secondary" onClick={() => DA.openCase(s.id)} style={sx('font-size:12px;padding:4px 10px')}>Open</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {total === 0 && (
          <div style={sx('padding:40px 0;display:flex;flex-direction:column;gap:8px;align-items:flex-start')}>
            <div style={sx('font-weight:800;font-size:18px')}>No cases match these filters.</div>
            <button className="btn btn-secondary" onClick={clearAll}>Clear filters</button>
          </div>
        )}
      </div>
      <div style={sx('display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px')}>
        <span style={sx('color:var(--color-neutral-700)')}>Showing {total ? page * per + 1 : 0}–{Math.min(total, page * per + per)} of {total}</span>
        <div style={sx('display:flex;gap:4px;align-items:center')}>
          <select value={String(per)} onChange={e => set({ per: +e.target.value })} className="input" style={sx('width:auto;min-height:32px;font-size:12.5px')}><option value="10">10 / page</option><option value="25">25 / page</option><option value="50">50 / page</option></select>
          <button className="btn btn-secondary" onClick={() => set({ page: Math.max(0, page - 1) })} disabled={page === 0} style={sx('padding:5px 10px')}>←</button>
          {Array.from({ length: pages }, (_, i) => <button key={i} onClick={() => set({ page: i })} style={{ ...sx('font:inherit;font-size:13px;min-width:32px;padding:5px 8px;cursor:pointer;border:1px solid var(--color-divider)'), background: i === page ? 'var(--color-text)' : 'transparent', color: i === page ? 'var(--color-bg)' : 'var(--color-text)' }}>{i + 1}</button>)}
          <button className="btn btn-secondary" onClick={() => set({ page: Math.min(pages - 1, page + 1) })} disabled={page >= pages - 1} style={sx('padding:5px 10px')}>→</button>
        </div>
      </div>
    </div>
  );
}
