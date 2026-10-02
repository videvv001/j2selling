/* Client-side store: state, persistence, lookups, derived metrics and actions.
   Mutations change state in place and then call emit(); React subscribes through useStore(). */
import { useSyncExternalStore, type CSSProperties } from 'react';
import { BRAND, STORE_KEY } from '../config';
import {
  ACTIVE, AWAITING, CUSTOMER_LABEL, CUSTOMER_STEPS, DAY, H, MON, REQUIRED_PHOTOS, SOURCES, STATUS,
  fmt, getClockStart, noise, now, pad, setClockStart, ts, uid,
} from './reference';
import { defaultChecklist, defaultFactors, seed } from './seed';
import type {
  Article, DialogOptions, Draft, Inspection, Offer, OfferType, Route, State, Status, Submission, Toast, ValuationFields,
} from './types';

const KEY = STORE_KEY;

/* ---------- state & persistence ---------- */
let S: State = load();
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s && s.submissions) { if (s.clockStart) setClockStart(s.clockStart); return s; }
    }
  } catch { /* ignore corrupt or unavailable storage */ }
  return fresh();
}
function fresh(): State {
  setClockStart(Date.now());
  const s = seed();
  s.clockStart = getClockStart();
  return s;
}

const subs = new Set<() => void>();
let version = 0;
let toasts: Toast[] = [];
let dialog: (DialogOptions & { value: string }) | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function save() {
  saveTimer = undefined;
  const json = JSON.stringify(S);
  try { localStorage.setItem(KEY, json); } catch { /* quota */ }
  // Mirror to the SQLite backend; failures are ignored so the app still works offline.
  fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: json, keepalive: json.length < 60000 }).catch(() => {});
}
// Writes are debounced; flush any pending write before the page goes away.
window.addEventListener('pagehide', () => { if (saveTimer) { clearTimeout(saveTimer); save(); } });

function emit() {
  version++;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 150);
  subs.forEach(f => { try { f(); } catch (e) { console.error(e); } });
}
function subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; }

/** Re-renders the calling component whenever the store changes. */
export function useStore(): number {
  return useSyncExternalStore(subscribe, () => version);
}

/* ---------- routing bridge ---------- */
// The router owns the URL; the store mirrors the parsed route so screens can read it synchronously.
let navigate: ((r: Route) => void) | null = null;
export function registerNavigator(fn: (r: Route) => void) { navigate = fn; }
/** Called while rendering the app shell after a URL change, so it updates silently (the shell is already re-rendering). */
export function syncRoute(r: Route) {
  const cur = S.route;
  if (cur && cur.area === r.area && cur.page === r.page && JSON.stringify(cur.params) === JSON.stringify(r.params)) return;
  S.route = r;
}

/* ---------- lookups ---------- */
const by = <T extends { id: string }>(arr: T[], id: string | null | undefined) => arr.find(x => x.id === id);
const sub = (id: string | null | undefined): Submission => (by(S.submissions, id) || S.submissions.find(s => s.ref === id))!;
const veh = (s: Submission) => by(S.vehicles, s.vehicleId)!;
const cust = (id: string | null | undefined) => by(S.customers, id)!;
const staffName = (id: string | null | undefined) => { const s = by(S.staff, id); if (s) return s.name; const c = by(S.customers, id); return c ? c.name : 'System'; };
const vName = (s: Submission) => { const v = veh(s); return v.year + ' ' + v.make + ' ' + v.model; };
const offersOf = (id: string) => S.offers.filter(o => o.submissionId === id).sort((a, b) => a.ts - b.ts);
const currentOffer = (id: string): Offer | null => offersOf(id).filter(o => !o.byCustomer).pop() || null;
const valuationOf = (id: string) => S.valuations.filter(v => v.submissionId === id).pop() || null;
const inspectionOf = (id: string) => S.inspections.filter(v => v.submissionId === id).pop() || null;
const saleOf = (id: string) => S.sales.find(v => v.submissionId === id) || null;
const photosOf = (id: string) => S.photos.filter(p => p.submissionId === id);
const msgsOf = (id: string) => S.messages.filter(m => m.submissionId === id).sort((a, b) => a.ts - b.ts);
const historyOf = (id: string) => S.statusHistory.filter(h => h.submissionId === id).sort((a, b) => a.ts - b.ts);

/** Status pill label and style. Customers see friendlier labels for some internal statuses. */
function badge(status: Status, customer?: boolean): { label: string; style: CSSProperties } {
  const tone = (STATUS[status] || [0, 'n'])[1];
  const label = customer ? (CUSTOMER_LABEL[status] || status) : status;
  const base: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', letterSpacing: '0.02em', padding: '3px 8px', whiteSpace: 'nowrap', fontWeight: 600, lineHeight: 1.3, border: '1px solid transparent' };
  const t: CSSProperties = {
    n: { background: 'var(--color-neutral-200)', color: 'var(--color-neutral-800)' },
    a: { background: 'var(--color-accent-700)', color: '#fff' },
    o: { background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', borderColor: 'var(--color-accent-300)' },
    k: { background: 'var(--color-text)', color: 'var(--color-bg)' },
    x: { background: 'transparent', color: 'var(--color-neutral-700)', borderColor: 'var(--color-neutral-400)' },
  }[tone];
  return { label, style: { ...base, ...t } };
}

export interface CustomerStep { label: string; state: 'done' | 'current' | 'todo'; date: string; done: boolean; current: boolean; todo: boolean; mark: string }

function customerSteps(s: Submission): CustomerStep[] {
  const st = STATUS[s.status][0];
  const h = historyOf(s.id);
  const when = (names: string[]) => { const x = h.filter(e => names.includes(e.status)).pop(); return x ? fmt.date(x.ts) : ''; };
  const dates = [when(['Submitted']), when(['Under Review']), when(['Valuated']), when(['Offer Sent', 'Offer Accepted']), when(['Inspection Completed', 'Inspection Scheduled']), when(['Payment Processing', 'Sale Agreed']), when(['Purchased'])];
  const terminal = st < 0;
  const reached = terminal ? Math.max(...h.filter(e => STATUS[e.status][0] >= 0).map(e => STATUS[e.status][0])) : st;
  return CUSTOMER_STEPS.map((label, i) => {
    const state = i < reached || (i === reached && s.status === 'Purchased') ? 'done' : i === reached && !terminal ? 'current' : 'todo';
    return { label, state, date: state === 'done' ? (dates[i] || '') : '', done: state === 'done', current: state === 'current', todo: state === 'todo', mark: state === 'done' ? '✓' : state === 'current' ? '●' : '○' };
  });
}

function customerNext(s: Submission) {
  const o = currentOffer(s.id);
  const map: Partial<Record<Status, [string, string]>> = {
    'Submitted': ['We’ve received your car', 'A valuator will review your details and photos, usually within 2 business hours.'],
    'Under Review': ['Your car is under review', 'We’re checking your details and photos. No action needed.'],
    'More Information Required': ['We need a bit more from you', 'Please check your messages — we’ve asked for additional photos or details.'],
    'Valuation In Progress': ['Valuation in progress', 'We’re preparing your offer. You’ll be notified as soon as it’s ready.'],
    'Valuated': ['Valuation in progress', 'We’re finalising your offer. You’ll be notified as soon as it’s ready.'],
    'Offer Sent': ['Review your offer', o ? 'We offered ' + fmt.peso(o.amount) + '. Valid until ' + fmt.dateLong(o.expires) + '.' : ''],
    'Negotiating': ['We’re reviewing your request', 'A valuator is looking at your counter-offer and will reply in Messages.'],
    'Offer Accepted': ['Schedule your inspection', 'Pick a date and place. Inspection takes about 45 minutes.'],
    'Inspection Scheduled': ['Inspection booked', ''],
    'Inspection Completed': ['Inspection complete', 'We’re confirming your final offer.'],
    'Final Offer': ['Confirm your final offer', o ? 'Final offer after inspection: ' + fmt.peso(o.amount) + '.' : ''],
    'Sale Agreed': ['Sale agreed — prepare documents', 'Bring your original OR/CR and two valid IDs. We prepare the Deed of Sale.'],
    'Payment Processing': ['Payment is on its way', 'Bank transfers usually land within 1 business day.'],
    'Purchased': ['Sold. Thank you!', 'Payment has been sent and the car is with us.'],
    'Customer Declined': ['You declined our offer', 'You can resubmit any time if your plans change.'],
    'Company Declined': ['We can’t make an offer for this car', 'See Messages for the reason.'],
    'Expired': ['Your offer expired', 'Ask us for a fresh valuation from Messages.'],
    'Cancelled': ['Submission cancelled', ''],
  };
  const r = [...(map[s.status] || ['', ''])];
  if (s.status === 'Inspection Scheduled') { const i = inspectionOf(s.id); if (i && i.date) r[1] = fmt.dateLong(ts(i.date)) + ' at ' + i.time + ' · ' + i.location; }
  return { title: r[0], body: r[1] };
}

function nextAction(s: Submission) {
  const m: Partial<Record<Status, [string, string]>> = {
    'Submitted': ['Start review', 'overview'], 'Under Review': ['Create valuation', 'valuation'], 'More Information Required': ['Waiting on customer', 'messages'],
    'Valuation In Progress': ['Finish valuation', 'valuation'], 'Valuated': ['Approve & send offer', 'valuation'], 'Offer Sent': ['Awaiting customer response', 'offers'],
    'Negotiating': ['Respond to counter-offer', 'offers'], 'Offer Accepted': ['Schedule inspection', 'inspection'], 'Inspection Scheduled': ['Complete inspection', 'inspection'],
    'Inspection Completed': ['Issue final offer', 'inspection'], 'Final Offer': ['Awaiting customer confirmation', 'offers'], 'Sale Agreed': ['Collect documents', 'sale'],
    'Payment Processing': ['Confirm payment', 'sale'], 'Purchased': ['Case complete', 'sale'],
  };
  const r = m[s.status] || ['Closed', 'activity'];
  return { label: r[0], tab: r[1] };
}

export interface AttentionItem { kind: string; sev: 'high' | 'med' | 'low'; subId: string; ref: string; vehicle: string; detail: string; hot: boolean }

/** Work queue for the admin dashboard, most urgent first. */
function attention(): AttentionItem[] {
  const out: AttentionItem[] = [];
  const add = (kind: string, sev: AttentionItem['sev'], s: Submission, detail: string) => out.push({ kind, sev, subId: s.id, ref: s.ref, vehicle: vName(s), detail, hot: sev === 'high' });
  S.submissions.forEach(s => {
    const age = (now() - s.submitted) / H;
    if (s.status === 'Submitted' && age > S.settings.attentionHours) add('New submission waiting ' + Math.floor(age) + 'h', 'high', s, s.assignedTo ? staffName(s.assignedTo) : 'Unassigned');
    else if (s.status === 'Submitted') add('New submission', 'med', s, s.assignedTo ? staffName(s.assignedTo) : 'Unassigned');
    const unread = S.messages.filter(m => m.submissionId === s.id && !m.readByAdmin && !by(S.staff, m.from));
    if (unread.length) add('Customer waiting for response', 'high', s, cust(s.customerId).name + ' · ' + fmt.ago(unread[unread.length - 1].ts));
    if (ACTIVE(s.status) && STATUS[s.status][0] <= 2) { const miss = REQUIRED_PHOTOS.filter(t => !photosOf(s.id).some(p => p.type === t)); if (miss.length) add('Missing vehicle photos', 'med', s, miss.length + ' required missing'); }
    const flagged = photosOf(s.id).filter(p => p.flagged); if (flagged.length && ACTIVE(s.status)) add('Poor-quality photo flagged', 'low', s, flagged.map(p => p.type).join(', '));
    const v = valuationOf(s.id); if (v && v.status === 'Draft') add('Valuation waiting for approval', 'med', s, fmt.peso(v.offer) + ' by ' + staffName(v.by));
    const o = currentOffer(s.id); if (o && o.status === 'Pending' && o.expires - now() < 2 * DAY) add('Offer expiring soon', 'high', s, 'Expires ' + fmt.dateTime(o.expires));
    const i = inspectionOf(s.id); if (i && i.status === 'Scheduled' && i.date && ts(i.date) + 12 * H < now()) add('Inspection overdue', 'high', s, fmt.date(ts(i.date)));
    if (s.status === 'Payment Processing') add('Payment pending', 'med', s, fmt.peso(saleOf(s.id)?.price));
  });
  const rank = { high: 0, med: 1, low: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

/* ---------- analytics ---------- */
// Headline figures are fixed sample baselines; actions taken during the demo (S.live) are added on top.
export type Range = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
export interface CustomRange { from: string; to: string }
type Base = { sub: number; rev: number; val: number; off: number; acc: number; pur: number; value: number; prev: { sub: number; off: number; acc: number; pur: number; value: number; awaiting: number; conv: number; avg?: number } };
const BASE: Record<Exclude<Range, 'custom'>, Base> = {
  today: { sub: 9, rev: 7, val: 5, off: 4, acc: 2, pur: 1, value: 585000, prev: { sub: 7, off: 3, acc: 2, pur: 2, value: 1140000, awaiting: 29, conv: 12.5 } },
  week: { sub: 46, rev: 40, val: 33, off: 19, acc: 10, pur: 8, value: 4610000, prev: { sub: 41, off: 17, acc: 8, pur: 7, value: 3980000, awaiting: 28, conv: 17.1 } },
  month: { sub: 187, rev: 161, val: 132, off: 74, acc: 39, pur: 32, value: 18420000, prev: { sub: 164, off: 66, acc: 33, pur: 27, value: 15230000, awaiting: 27, conv: 16.5 } },
  quarter: { sub: 548, rev: 476, val: 391, off: 218, acc: 112, pur: 94, value: 53580000, prev: { sub: 471, off: 190, acc: 95, pur: 78, value: 43900000, awaiting: 24, conv: 16.6 } },
  year: { sub: 1964, rev: 1702, val: 1391, off: 781, acc: 402, pur: 339, value: 190850000, prev: { sub: 1510, off: 590, acc: 301, pur: 250, value: 136200000, awaiting: 22, conv: 16.6 } },
};
export const RANGE_LABEL: Record<Range, string> = { today: 'Today', week: 'This Week', month: 'This Month', quarter: 'This Quarter', year: 'This Year', custom: 'Custom Range' };

function rangeBase(range: Range, custom?: CustomRange): Base {
  if (range !== 'custom') return BASE[range];
  const days = Math.max(1, Math.round((Date.parse(custom!.to) - Date.parse(custom!.from)) / DAY) + 1);
  const k = days / 29, m = BASE.month;
  const r = (x: number) => Math.round(x * k);
  return {
    sub: r(m.sub), rev: r(m.rev), val: r(m.val), off: r(m.off), acc: r(m.acc), pur: r(m.pur), value: r(m.value),
    prev: { sub: r(m.prev.sub), off: r(m.prev.off), acc: r(m.prev.acc), pur: r(m.prev.pur), value: r(m.prev.value), awaiting: 27, conv: 16.5 },
  };
}

export interface Change { txt: string; up: boolean }
export interface Kpis {
  sub: number; rev: number; val: number; off: number; acc: number; pur: number; value: number; awaiting: number;
  avg: number; conv: number; accRate: number; change: Record<'sub' | 'awaiting' | 'off' | 'acc' | 'pur' | 'value' | 'avg' | 'conv', Change>;
}
function kpis(range: Range, custom?: CustomRange): Kpis {
  const b = rangeBase(range, custom), L = S.live;
  const awaiting = 25 + S.submissions.filter(s => AWAITING.includes(s.status)).length;
  const sum = { sub: b.sub + L.sub, rev: b.rev + L.rev, val: b.val + L.val, off: b.off + L.off, acc: b.acc + L.acc, pur: b.pur + L.pur, value: b.value + L.value, awaiting };
  const avg = sum.pur ? sum.value / sum.pur : 0, conv = sum.sub ? sum.pur / sum.sub * 100 : 0, accRate = sum.off ? sum.acc / sum.off * 100 : 0;
  const p = b.prev; const pAvg = p.value / p.pur;
  const ch = (a: number, c: number): Change => { const d = c ? (a - c) / c * 100 : 0; return { txt: (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + '%', up: d >= 0 }; };
  return {
    ...sum, avg, conv, accRate,
    change: { sub: ch(sum.sub, p.sub), awaiting: ch(awaiting, p.awaiting), off: ch(sum.off, p.off), acc: ch(sum.acc, p.acc), pur: ch(sum.pur, p.pur), value: ch(sum.value, p.value), avg: ch(avg, pAvg), conv: ch(conv, p.conv) },
  };
}
function buckets(range: Range, custom?: CustomRange): string[] {
  if (range === 'today') return ['6 AM', '7 AM', '8 AM', '9 AM', '10 AM'];
  if (range === 'week') return [23, 24, 25, 26, 27, 28, 29].map(d => 'Sep ' + d);
  if (range === 'month') return Array.from({ length: 29 }, (_, i) => 'Sep ' + (i + 1));
  if (range === 'quarter') return Array.from({ length: 13 }, (_, i) => { const d = new Date(Date.UTC(2026, 6, 1 + i * 7)); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); });
  if (range === 'year') return MON.slice(0, 9);
  const f = Date.parse(custom!.from), t = Date.parse(custom!.to), days = Math.max(1, Math.round((t - f) / DAY) + 1);
  const step = days > 45 ? 7 : 1;
  return Array.from({ length: Math.ceil(days / step) }, (_, i) => fmt.date(f + i * step * DAY));
}
function distribute(total: number, n: number, sd: number, trend = 0.3): number[] {
  const w = Array.from({ length: n }, (_, i) => 0.55 + noise(i, sd) * 0.9 + trend * i / n);
  const sum = w.reduce((a, b) => a + b, 0);
  const out = w.map(x => Math.floor(x / sum * total));
  let rem = total - out.reduce((a, b) => a + b, 0);
  for (let i = n - 1; rem > 0; i = (i - 1 + n) % n) { out[i]++; rem--; }
  return out;
}
export interface SeriesPoint { label: string; sub: number; pur: number; value: number; off: number; avg: number }
function series(range: Range, custom?: CustomRange): SeriesPoint[] {
  const b = rangeBase(range, custom), L = S.live, labels = buckets(range, custom), n = labels.length;
  const subv = distribute(b.sub, n, 1), pur = distribute(b.pur, n, 2, 0.4), off = distribute(b.off, n, 5);
  const value = pur.map((p, i) => p * (520000 + noise(i, 3) * 110000));
  const vs = value.reduce((a, c) => a + c, 0) || 1; const vk = b.value / vs;
  const val = value.map(v => Math.round(v * vk / 1000) * 1000);
  subv[n - 1] += L.sub; pur[n - 1] += L.pur; val[n - 1] += L.value; off[n - 1] += L.off;
  return labels.map((l, i) => ({ label: l, sub: subv[i], pur: pur[i], value: val[i], off: off[i], avg: pur[i] ? Math.round(val[i] / pur[i]) : 0 }));
}
export const MAKE_SHARE: Record<string, [number, number, number]> = { Toyota: [.28, .31, 612000], Mitsubishi: [.14, .15, 598000], Honda: [.13, .14, 588000], Ford: [.09, .08, 868000], Nissan: [.08, .07, 642000], Suzuki: [.08, .08, 455000], Hyundai: [.07, .06, 498000], Kia: [.05, .04, 690000], Mazda: [.04, .04, 715000], Isuzu: [.04, .03, 925000] };
export const MODEL_SHARE: [string, number, number][] = [['Toyota Vios', .09, .11], ['Mitsubishi Mirage G4', .06, .07], ['Toyota Innova', .06, .06], ['Honda City', .05, .06], ['Toyota Fortuner', .05, .05], ['Ford Ranger', .05, .04], ['Mitsubishi Montero Sport', .04, .04], ['Suzuki Ertiga', .04, .04], ['Nissan Navara', .04, .03], ['Toyota Wigo', .04, .03]];
export const LOC_SHARE: Record<string, number> = { 'Quezon City': .19, 'Makati': .09, 'Pasig': .1, 'Taguig': .08, 'Mandaluyong': .05, 'Manila': .09, 'Parañaque': .07, 'Las Piñas': .06, 'Caloocan': .07, 'Antipolo': .05, 'Cebu City': .09, 'Davao City': .06 };
const SOURCE_Q: Record<string, number[]> = { 'Google Ads': [420, 210, 96, 51, 43], 'Facebook': [310, 118, 44, 22, 18], 'Instagram': [140, 52, 20, 9, 7], 'TikTok': [180, 46, 14, 6, 4], 'Organic Search': [150, 62, 22, 11, 10], 'Direct': [70, 28, 9, 5, 4], 'Referral': [40, 18, 7, 5, 4], 'Email': [35, 8, 3, 2, 2], 'Partner': [22, 4, 2, 1, 1], 'Other': [30, 2, 1, 0, 1] };
export interface SourceRow { name: string; leads: number; subs: number; offers: number; acc: number; pur: number; value: number; conv: number }
function sourceTable(range: Range, custom?: CustomRange): SourceRow[] {
  const b = rangeBase(range, custom), k = b.sub / BASE.quarter.sub;
  return SOURCES.map((name, i) => {
    const q = SOURCE_Q[name]; const r = q.map(x => Math.round(x * k));
    const g = name === 'Google Ads';
    const livePur = g ? S.live.pur : 0, liveSub = g ? S.live.sub : 0;
    const pur = r[4] + livePur, value = Math.round(r[4] * (540000 + noise(i, 9) * 90000) / 1000) * 1000 + (g ? S.live.value : 0);
    return { name, leads: r[0] + liveSub, subs: r[1] + liveSub, offers: r[2] + (g ? S.live.off : 0), acc: r[3] + (g ? S.live.acc : 0), pur, value, conv: r[0] ? pur / (r[0] + liveSub) * 100 : 0 };
  });
}
export interface StaffPerfRow { id: string; name: string; role: string; assigned: number; pending: number; valuations: number; offers: number; purchased: number; response: number; ttv: number; value: number; inspections: number; overdue: number }
function staffPerf(range: Range): StaffPerfRow[] {
  const k = (range === 'custom' ? BASE.month : BASE[range]).sub / BASE.month.sub;
  const base: Record<string, number[]> = { s1: [58, 11, 51, 29, 14, 1.4, 5.2, 8120000], s4: [52, 9, 47, 26, 12, 1.9, 6.1, 6940000], s2: [18, 3, 21, 12, 6, 0.8, 3.9, 3360000], s3: [26, 4, 0, 0, 0, 2.3, 0, 0], s5: [22, 5, 0, 0, 0, 3.1, 0, 0], s7: [40, 6, 0, 0, 0, 0.6, 0, 0] };
  return Object.keys(base).map(id => {
    const b = base[id], st = by(S.staff, id)!;
    const mine = S.submissions.filter(s => s.assignedTo === id);
    const live = mine.filter(s => s.live);
    const pending = mine.filter(s => ACTIVE(s.status)).length;
    const inspections = S.inspections.filter(i => i.inspector === id);
    return { id, name: st.name, role: st.role, assigned: Math.round(b[0] * k) + live.length, pending: b[1] + pending, valuations: Math.round(b[2] * k) + live.filter(s => valuationOf(s.id)).length, offers: Math.round(b[3] * k) + live.filter(s => currentOffer(s.id)).length, purchased: Math.round(b[4] * k) + live.filter(s => s.status === 'Purchased').length, response: b[5], ttv: b[6], value: Math.round(b[7] * k) + live.filter(s => s.status === 'Purchased').reduce((a, s) => a + (saleOf(s.id)?.price || 0), 0), inspections: inspections.length + (st.role === 'Inspector' ? Math.round(24 * k) : 0), overdue: inspections.filter(i => i.status === 'Scheduled' && i.date && ts(i.date) < now()).length };
  });
}
const PIPE_BASE: Partial<Record<Status, number>> = { 'Submitted': 6, 'Under Review': 10, 'More Information Required': 3, 'Valuation In Progress': 9, 'Valuated': 4, 'Offer Sent': 19, 'Negotiating': 7, 'Offer Accepted': 5, 'Inspection Scheduled': 4, 'Inspection Completed': 1, 'Final Offer': 2, 'Sale Agreed': 2, 'Payment Processing': 1 };
function pipeline() {
  return (Object.keys(PIPE_BASE) as Status[]).map(st => ({ label: st, value: PIPE_BASE[st]! + S.submissions.filter(s => s.status === st).length }));
}

/* ---------- mutations ---------- */
const me = () => S.session.adminId || 's2';
function log(action: string, record: string, details?: string, user?: string | null) { S.activity.push({ id: uid('a'), ts: now(), user: user === undefined ? me() : user, action, record, details: details || '' }); }
function notify(audience: 'admin' | 'customer', text: string, submissionId?: string, customerId?: string) { S.notifications.push({ id: uid('nt'), audience, text, submissionId, customerId, ts: now(), read: false }); }
function setStatusInternal(id: string, status: Status, byId?: string) {
  const s = sub(id); if (!s || s.status === status) return;
  const prev = s.status; s.status = status; s.updated = now();
  S.statusHistory.push({ id: uid('h'), submissionId: s.id, status, ts: now(), by: byId === undefined ? me() : byId });
  log('Status changed', s.ref, prev + ' → ' + status, byId === undefined ? me() : byId);
  if (s.live) {
    if (status === 'Under Review') S.live.rev++;
    if (status === 'Valuated') S.live.val++;
    if (status === 'Offer Sent') S.live.off++;
    if (status === 'Offer Accepted') S.live.acc++;
  }
}

function emptyDraft(): Draft {
  return { step: 0, vehicle: { plate: '', make: '', model: '', variant: '', year: '', transmission: '', fuel: '', engine: '', mileage: '', color: '' }, condition: { overall: '', accident: '', accidentDetails: '', mechanical: '', mechanicalDetails: '', warningLights: '', warningDetails: '', service: '', keys: '', modifications: '', modificationDetails: '', damage: '', info: '' }, ownership: { registeredOwner: '', ownershipStatus: '', registration: '', financing: '', financeCompany: '', outstanding: '', documents: [], orcr: '', prevOwners: '' }, photos: {}, contact: { first: '', last: '', email: '', phone: '', city: '', location: '', pref: 'SMS', password: '', confirm: '', source: 'Google Ads' } };
}
function demoDraft(): Draft {
  return {
    step: 0, vehicle: { plate: 'ABC 1234', make: 'Toyota', model: 'Vios', variant: '1.5 G CVT', year: '2022', transmission: 'CVT', fuel: 'Gasoline', engine: '1.5L Gasoline', mileage: '32410', color: 'Silver' },
    condition: { overall: 'Good', accident: 'No', accidentDetails: '', mechanical: 'No', mechanicalDetails: '', warningLights: 'No', warningDetails: '', service: 'Full dealer history', keys: '2', modifications: 'No', modificationDetails: '', damage: 'Minor scratches on rear bumper', info: 'Casa-maintained every 10,000 km at Toyota Quezon Avenue. Complete service booklet.' },
    ownership: { registeredOwner: 'Yes, I am the registered owner', ownershipStatus: 'Fully paid', registration: 'Registered, up to date', financing: 'No', financeCompany: '', outstanding: '', documents: ['OR/CR', 'Valid ID', 'Service records'], orcr: 'Original available', prevOwners: '1' },
    photos: {}, contact: { first: 'Juan', last: 'Dela Cruz', email: 'juan.delacruz@gmail.com', phone: '0917 555 0124', city: 'Quezon City', location: 'Brgy. Teachers Village East, Quezon City', pref: 'SMS', password: 'demo1234', confirm: 'demo1234', source: 'Google Ads' },
  };
}

const newSaleDocs = () => ({ 'Signed Deed of Sale': false, 'Original OR/CR': false, 'Valid IDs (2)': false, 'Release of chattel mortgage': true });

const actions = {
  go(area: Route['area'], page?: string, params?: Route['params']) {
    const r: Route = { area, page: page || 'home', params: params || {} };
    S.route = r;
    if (navigate) navigate(r);
    emit();
    try { window.scrollTo(0, 0); document.querySelectorAll('[data-scroll-root]').forEach(e => (e.scrollTop = 0)); } catch { /* noop */ }
  },
  loginCustomer(id?: string) { S.session.customerId = id || 'c1'; emit(); },
  loginAdmin(id?: string) { S.session.adminId = id || 's2'; emit(); },
  logout(area: 'admin' | 'customer') { if (area === 'admin') S.session.adminId = null; else S.session.customerId = null; emit(); },
  toast(text: string, tone?: string) {
    const t = { id: uid('t'), text, tone: tone || 'ok' }; toasts = toasts.concat(t); emit();
    setTimeout(() => { toasts = toasts.filter(x => x !== t); emit(); }, 3800);
  },
  confirm(opts: DialogOptions) { dialog = { input: null, ...opts, value: opts.value ?? '' }; emit(); },
  closeDialog() { dialog = null; emit(); },
  setDialogValue(v: string) { if (dialog) { dialog = { ...dialog, value: v }; emit(); } },
  reset() { try { localStorage.removeItem(KEY); } catch { /* noop */ } const route = S.route; S = fresh(); S.route = route; toasts = []; dialog = null; emit(); actions.toast('Demo data reset'); },
  setDraft(d: Draft | null) { S.draft = d; emit(); },
  setUI(p: Record<string, unknown>) { S.ui = { ...(S.ui || {}), ...p }; emit(); },
  demoDraft, emptyDraft,
  submitDraft(): string | null {
    const d = S.draft; if (!d) return null;
    let c = S.customers.find(x => x.email.toLowerCase() === d.contact.email.toLowerCase());
    if (!c) { c = { id: uid('c'), first: d.contact.first, last: d.contact.last, name: d.contact.first + ' ' + d.contact.last, email: d.contact.email, phone: d.contact.phone, city: d.contact.city, registered: now(), source: d.contact.source || 'Direct', contactPref: d.contact.pref, notes: [] }; S.customers.push(c); log('Customer registered', c.name, c.email, c.id); }
    S.session.customerId = c.id;
    const n = S.nextRef++; const id = 'sub' + n, ref = 'CAR-2026-' + pad(n, 5), v = d.vehicle;
    S.vehicles.push({ id: 'veh' + n, customerId: c.id, make: v.make, model: v.model, variant: v.variant, year: +v.year, plate: v.plate.toUpperCase(), mileage: +String(v.mileage).replace(/\D/g, ''), color: v.color, transmission: v.transmission, fuel: v.fuel, engine: v.engine });
    S.conditions.push({ id: 'cond' + n, submissionId: id, ...d.condition });
    S.ownerships.push({ id: 'own' + n, submissionId: id, ...d.ownership, outstanding: +String(d.ownership.outstanding || 0).replace(/\D/g, '') });
    Object.keys(d.photos).forEach((type, k) => { const p = d.photos[type]; if (p && p.done) S.photos.push({ id: 'ph' + n + '_' + k, submissionId: id, type, url: p.url || null, flagged: false, uploaded: now() }); });
    S.submissions.push({ id, ref, vehicleId: 'veh' + n, customerId: c.id, status: 'Submitted', assignedTo: 's1', source: d.contact.source || 'Google Ads', location: d.contact.city, address: d.contact.location, submitted: now(), updated: now(), contactPref: d.contact.pref, live: true });
    S.statusHistory.push({ id: uid('h'), submissionId: id, status: 'Submitted', ts: now(), by: c.id });
    log('Vehicle submitted', ref, v.year + ' ' + v.make + ' ' + v.model, c.id);
    notify('admin', 'New vehicle submitted — ' + v.make + ' ' + v.model + ' ' + v.year + ' (' + ref + ')', id);
    notify('customer', 'We received your ' + v.year + ' ' + v.make + ' ' + v.model + '. Reference ' + ref + '.', id, c.id);
    S.live.sub++; S.draft = null; S.lastSubmitted = ref; emit(); return ref;
  },
  setStatus(id: string, status: Status) { setStatusInternal(id, status); const s = sub(id); if (status === 'More Information Required') notify('customer', 'We need more information about your ' + vName(s) + '.', s.id, s.customerId); emit(); },
  assign(id: string, staffId: string | null) { const s = sub(id); s.assignedTo = staffId; log('Case assigned', s.ref, 'Assigned to ' + staffName(staffId)); emit(); },
  addNote(id: string, text: string) { S.notes.push({ id: uid('n'), submissionId: sub(id).id, by: me(), ts: now(), text }); log('Internal note added', sub(id).ref, text.slice(0, 60)); emit(); },
  addCustomerNote(cid: string, text: string) { cust(cid).notes.push({ id: uid('cn'), by: me(), ts: now(), text }); emit(); },
  openCase(id: string, tab?: string) { const s = sub(id); log('Vehicle opened', s.ref, tab || 'Overview'); actions.go('admin', 'workspace', { id: s.id, tab: tab || 'overview' }); },
  saveValuation(id: string, vals: ValuationFields, approve?: boolean) {
    const s = sub(id); let v = valuationOf(s.id);
    if (!v) { v = { id: uid('val'), submissionId: s.id, by: me(), ts: now(), status: 'Draft', ...vals }; S.valuations.push(v); log('Valuation created', s.ref, fmt.peso(vals.offer)); } else log('Valuation changed', s.ref, fmt.peso(vals.offer));
    Object.assign(v, vals, { ts: now() });
    if (approve) { v.status = 'Approved'; v.approvedBy = me(); log('Valuation approved', s.ref, fmt.peso(v.offer)); }
    if (['Submitted', 'Under Review', 'More Information Required'].includes(s.status)) setStatusInternal(s.id, 'Valuation In Progress');
    if (approve && s.status === 'Valuation In Progress') setStatusInternal(s.id, 'Valuated');
    emit();
  },
  sendOffer(id: string, amount: number | string, type?: OfferType, notes?: string, days?: number) {
    const s = sub(id);
    offersOf(s.id).forEach(o => { if (o.status === 'Pending' || o.status === 'Countered') o.status = 'Superseded'; });
    const o: Offer = { id: uid('off'), submissionId: s.id, type: type || 'Initial Offer', amount: +amount, by: me(), byCustomer: false, ts: now(), expires: now() + (days || S.settings.offerValidity) * DAY, status: 'Pending', notes: notes || '' };
    if (type === 'Customer Counter') { o.byCustomer = true; o.by = s.customerId; o.status = 'Countered'; S.offers.push(o); setStatusInternal(s.id, 'Negotiating'); log('Customer counter recorded', s.ref, fmt.peso(amount)); emit(); return; }
    S.offers.push(o);
    const v = valuationOf(s.id); if (v && v.status === 'Draft') { v.status = 'Approved'; v.approvedBy = me(); }
    if (s.status === 'Valuation In Progress') setStatusInternal(s.id, 'Valuated');
    setStatusInternal(s.id, type === 'Final Offer' ? 'Final Offer' : 'Offer Sent');
    log('Offer sent', s.ref, o.type + ' ' + fmt.peso(amount));
    notify('customer', (type === 'Final Offer' ? 'Your final offer is ready: ' : 'You received an offer of ') + fmt.peso(amount) + '.', s.id, s.customerId);
    if (type !== 'Final Offer' && !historyOf(s.id).some(h => h.status === 'Valuated' && h.notified)) notify('customer', 'Your valuation is ready.', s.id, s.customerId);
    emit();
  },
  acceptOffer(id: string) {
    const s = sub(id), o = currentOffer(s.id); if (!o) return;
    o.status = 'Accepted'; o.acceptedAt = now();
    log('Offer accepted', s.ref, fmt.peso(o.amount), s.customerId);
    if (o.type === 'Final Offer' || s.status === 'Final Offer') {
      setStatusInternal(s.id, 'Sale Agreed', s.customerId);
      if (!saleOf(s.id)) S.sales.push({ id: uid('sale'), submissionId: s.id, price: o.amount, agreed: now(), stage: 'Sale Agreed', staff: s.assignedTo, docs: newSaleDocs() });
      notify('admin', 'Customer accepted final offer — ' + vName(s) + ' (' + s.ref + ')', s.id);
    } else { setStatusInternal(s.id, 'Offer Accepted', s.customerId); notify('admin', 'Customer accepted offer — ' + vName(s) + ' (' + s.ref + ')', s.id); }
    emit();
  },
  declineOffer(id: string, reason?: string) {
    const s = sub(id), o = currentOffer(s.id); if (o) { o.status = 'Declined'; o.declineReason = reason || ''; }
    setStatusInternal(s.id, 'Customer Declined', s.customerId); log('Offer declined', s.ref, reason || 'No reason given', s.customerId);
    notify('admin', 'Customer declined offer — ' + vName(s) + ' (' + s.ref + ')', s.id); emit();
  },
  sendMessage(id: string, from: string, text: string, attachment?: string | null) {
    const s = sub(id); const isStaff = !!by(S.staff, from);
    S.messages.push({ id: uid('m'), submissionId: s.id, from, text, ts: now(), readByAdmin: isStaff, readByCustomer: !isStaff, attachment: attachment || null });
    if (isStaff) notify('customer', 'New message about your ' + vName(s) + '.', s.id, s.customerId); else notify('admin', 'Customer sent a message — ' + cust(s.customerId).name + ' on ' + s.ref, s.id);
    emit();
  },
  markRead(id: string, audience: 'admin' | 'customer') {
    let ch = false;
    S.messages.forEach(m => { if (m.submissionId === id) { if (audience === 'admin' && !m.readByAdmin) { m.readByAdmin = true; ch = true; } if (audience === 'customer' && !m.readByCustomer) { m.readByCustomer = true; ch = true; } } });
    if (ch) emit();
  },
  readNotifications(audience: 'admin' | 'customer') { S.notifications.forEach(n => { if (n.audience === audience) n.read = true; }); emit(); },
  flagPhoto(pid: string) { const p = by(S.photos, pid)!; p.flagged = !p.flagged; log(p.flagged ? 'Photo flagged' : 'Photo flag cleared', sub(p.submissionId).ref, p.type); emit(); },
  requestPhoto(id: string, type: string, reason?: string) {
    const s = sub(id);
    actions.sendMessage(s.id, me(), 'Could you upload a clearer ' + type.toLowerCase() + ' photo? ' + (reason || 'The current one is blurry or too dark.') + ' You can replace it from the Photos tab.');
    notify('customer', 'Please upload a better ' + type.toLowerCase() + ' photo.', s.id, s.customerId);
    S.photoRequests = (S.photoRequests || []).concat({ submissionId: s.id, type, ts: now() });
    log('Photo requested', s.ref, type); emit();
  },
  uploadPhoto(id: string, type: string, url?: string | null) {
    const s = sub(id); const ex = photosOf(s.id).find(p => p.type === type);
    if (ex) { ex.url = url || null; ex.flagged = false; ex.uploaded = now(); } else S.photos.push({ id: uid('ph'), submissionId: s.id, type, url: url || null, flagged: false, uploaded: now() });
    S.photoRequests = (S.photoRequests || []).filter(r => !(r.submissionId === s.id && r.type === type));
    log('Photo uploaded', s.ref, type, s.customerId); notify('admin', 'Customer uploaded a ' + type.toLowerCase() + ' photo — ' + s.ref, s.id); emit();
  },
  scheduleInspection(id: string, d: { date: string; time: string; location: string; inspector: string }, byCustomer?: boolean) {
    const s = sub(id); let i: Inspection | null = inspectionOf(s.id);
    if (!i || i.status === 'Completed' || i.status === 'Failed') { i = { id: uid('ins'), submissionId: s.id, status: 'Scheduled', checklist: {}, findings: '', notes: '', recommended: null }; S.inspections.push(i); }
    Object.assign(i, d, { status: 'Scheduled', ts: ts(d.date) });
    setStatusInternal(s.id, 'Inspection Scheduled', byCustomer ? s.customerId : undefined);
    log('Inspection scheduled', s.ref, d.date + ' ' + d.time + ' · ' + staffName(d.inspector), byCustomer ? s.customerId : undefined);
    notify('customer', 'Your inspection is scheduled for ' + fmt.date(ts(d.date)) + ', ' + d.time + '.', s.id, s.customerId);
    if (byCustomer) notify('admin', 'Customer booked inspection — ' + s.ref + ' on ' + fmt.date(ts(d.date)), s.id);
    emit();
  },
  updateInspection(id: string, patch: Partial<Inspection>) { const i = inspectionOf(sub(id).id)!; Object.assign(i, patch); emit(); },
  startInspection(id: string) { const i = inspectionOf(sub(id).id)!; i.status = 'In Progress'; log('Inspection started', sub(id).ref, staffName(i.inspector)); emit(); },
  completeInspection(id: string, result?: Inspection['status']) {
    const s = sub(id), i = inspectionOf(s.id)!; i.status = result || 'Completed'; i.completedAt = now();
    if (i.status === 'Completed') { setStatusInternal(s.id, 'Inspection Completed'); notify('admin', 'Inspection completed — ' + vName(s) + ' (' + s.ref + ')', s.id); }
    log('Inspection ' + i.status.toLowerCase(), s.ref, i.findings.slice(0, 60)); emit();
  },
  agreeSale(id: string, price?: number) {
    const s = sub(id); const o = currentOffer(s.id); if (o && o.status === 'Pending') { o.status = 'Accepted'; o.acceptedAt = now(); }
    const amount = price || o?.amount || 0;
    if (!saleOf(s.id)) S.sales.push({ id: uid('sale'), submissionId: s.id, price: amount, agreed: now(), stage: 'Sale Agreed', staff: s.assignedTo, docs: newSaleDocs() });
    setStatusInternal(s.id, 'Sale Agreed'); log('Purchase record created', s.ref, fmt.peso(amount)); emit();
  },
  toggleDoc(id: string, doc: string) { const sl = saleOf(sub(id).id)!; sl.docs[doc] = !sl.docs[doc]; emit(); },
  advanceSale(id: string) {
    const s = sub(id), sl = saleOf(s.id)!; const order = ['Sale Agreed', 'Documents Pending', 'Payment Processing', 'Paid', 'Vehicle Received', 'Completed'] as const;
    const next = order[order.indexOf(sl.stage) + 1]; if (!next) return;
    sl.stage = next; log('Purchase stage', s.ref, next);
    if (next === 'Payment Processing') { setStatusInternal(s.id, 'Payment Processing'); S.payments.push({ id: uid('pay'), saleId: sl.id, amount: sl.price, method: 'Bank transfer · BPI', status: 'Processing', ts: now(), reference: 'BPI-' + Math.floor(887200 + Math.random() * 999) }); }
    if (next === 'Paid') { const p = S.payments.find(x => x.saleId === sl.id); if (p) { p.status = 'Paid'; p.ts = now(); } notify('customer', 'Your payment has been processed. ' + fmt.peso(sl.price) + ' sent by bank transfer.', s.id, s.customerId); }
    if (next === 'Completed') {
      setStatusInternal(s.id, 'Purchased'); log('Purchase completed', s.ref, fmt.peso(sl.price));
      if (s.live) { S.live.pur++; S.live.value += sl.price; }
      notify('customer', 'Sale complete. Thank you for selling your ' + vName(s) + ' to ' + BRAND.name + '.', s.id, s.customerId);
    }
    emit();
  },
  uploadDoc(id: string, name: string, file?: string) {
    const s = sub(id);
    S.documents = (S.documents || []).filter(d => !(d.submissionId === s.id && d.name === name)).concat({ id: uid('doc'), submissionId: s.id, name, file: file || name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf', ts: now(), by: s.customerId });
    log('Document uploaded', s.ref, name, s.customerId); notify('admin', 'Customer uploaded ' + name + ' — ' + s.ref, s.id); emit();
  },
  updateCustomer(cid: string, patch: Partial<{ first: string; last: string; email: string; phone: string; city: string; contactPref: string }>) { const c = cust(cid); Object.assign(c, patch); c.name = c.first + ' ' + c.last; log('Profile updated', c.name, Object.keys(patch).join(', '), cid); emit(); },
  saveArticle(a: Article) { const ex = by(S.articles, a.id); if (ex) Object.assign(ex, a); else S.articles.unshift(a); log(a.status === 'Published' ? 'Article published' : 'Article saved', a.title, a.status); emit(); },
  togglePerm(role: string, perm: string) { const r = S.roles[role]; const i = r.indexOf(perm); if (i >= 0) r.splice(i, 1); else r.push(perm); log('Staff permissions changed', 'Role: ' + role, (i >= 0 ? '− ' : '+ ') + perm); emit(); },
  addStaff(name: string, role: string, email: string) { S.staff.push({ id: uid('s'), name, role, email, active: true, lastActive: now() }); log('Staff invited', name, role); emit(); },
  setStaffRole(id: string, role: string) { const s = by(S.staff, id)!; const old = s.role; s.role = role; log('Staff role changed', s.name, old + ' → ' + role); emit(); },
  toggleStaff(id: string) { const s = by(S.staff, id)!; s.active = !s.active; log(s.active ? 'Staff reactivated' : 'Staff deactivated', s.name, s.role); emit(); },
  saveSettings(p: Partial<State['settings']>) { Object.assign(S.settings, p); log('Settings changed', 'Company settings', Object.keys(p).join(', ')); emit(); },
  /** Demo presets: advance the demo Vios case to a given stage without clicking through every step. */
  preset(stage: 'Submitted' | 'Offer Sent' | 'Offer Accepted' | 'Inspection Completed') {
    if (!S.submissions.some(s => s.live)) { S.draft = demoDraft(); REQUIRED_PHOTOS.concat(['Engine bay']).forEach(t => (S.draft!.photos[t] = { done: true, progress: 100 })); actions.submitDraft(); }
    const s = S.submissions.filter(x => x.live).pop()!;
    const order = ['Submitted', 'Offer Sent', 'Offer Accepted', 'Inspection Completed'];
    const want = order.indexOf(stage);
    const cur = () => order.indexOf(s.status) >= 0 ? order.indexOf(s.status) : (({ 'Under Review': 0, 'Valuation In Progress': 0, 'Valuated': 0, 'Inspection Scheduled': 2 } as Record<string, number>)[s.status] ?? 9);
    if (want >= 1 && cur() < 1) { setStatusInternal(s.id, 'Under Review', 's1'); actions.saveValuation(s.id, { market: 610000, recommended: 570000, maximum: 585000, repair: 12000, recon: 8000, offer: 570000, factors: defaultFactors(0), notes: 'Casa-maintained, low mileage for age.' }, true); actions.sendOffer(s.id, 570000, 'Initial Offer', ''); }
    if (want >= 2 && cur() < 2) actions.acceptOffer(s.id);
    if (want >= 3 && cur() < 3) { actions.scheduleInspection(s.id, { date: fmt.iso(now() + DAY), time: '10:00 AM', location: 'Customer address — Quezon City', inspector: 's3' }); const i = inspectionOf(s.id)!; i.checklist = defaultChecklist(false); i.findings = 'Matches submission. Minor scratches on rear bumper as disclosed.'; actions.completeInspection(s.id); }
    S.session.customerId = S.session.customerId || s.customerId; S.session.adminId = S.session.adminId || 's2';
    emit(); actions.toast('Demo moved to: ' + s.status);
  },
};

export interface SearchResult { type: 'Vehicle' | 'Customer'; id: string; title: string; sub: string; exact?: boolean }
function search(q: string): SearchResult[] {
  q = (q || '').trim().toLowerCase(); if (q.length < 2) return [];
  const res: SearchResult[] = [];
  S.submissions.forEach(s => {
    const v = veh(s), c = cust(s.customerId);
    const hay = [s.ref, v.plate, v.make, v.model, v.make + ' ' + v.model, c.name, c.email, c.phone.replace(/\s/g, ''), c.phone].join(' | ').toLowerCase();
    if (hay.includes(q) || hay.includes(q.replace(/\s/g, ''))) res.push({ type: 'Vehicle', id: s.id, title: s.ref + ' · ' + vName(s), sub: c.name + ' · ' + v.plate + ' · ' + s.status, exact: s.ref.toLowerCase() === q });
  });
  S.customers.forEach(c => { if ((c.name + ' ' + c.email + ' ' + c.phone).toLowerCase().includes(q)) res.push({ type: 'Customer', id: c.id, title: c.name, sub: c.email + ' · ' + c.phone }); });
  return res.slice(0, 8);
}

/** The store API used by every screen. */
export const DA = {
  get S() { return S; }, get toasts() { return toasts; }, get dialog() { return dialog; },
  subscribe,
  sub, veh, cust, staffName, vName, offersOf, currentOffer, valuationOf, inspectionOf, saleOf, photosOf, msgsOf, historyOf,
  badge, customerSteps, customerNext, nextAction, attention, kpis, series, sourceTable, staffPerf, pipeline, search, defaultFactors, defaultChecklist,
  ...actions,
};
