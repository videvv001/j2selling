import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BRAND } from '../../config';
import { sx } from '../../lib/sx';
import {
  CHECK_AREAS, DA, MAKE_SHARE, OPTIONAL_PHOTOS, REQUIRED_PHOTOS, STATUS, STATUS_ORDER, fmt, now, ts, uid,
  type CheckResult, type FactorImpact, type OfferType, type SaleStage, type Status, type Submission, type ValuationFields,
} from '../../store';

const HATCH = 'repeating-linear-gradient(135deg,var(--color-neutral-300) 0 1px,var(--color-neutral-200) 1px 9px)';
const CANNED = ['We can review the valuation again based on the service history.', 'Could you send the service booklet pages as photos?', 'Your inspection is confirmed. Please have both keys and the OR/CR ready.'];
const SALE_ORDER: SaleStage[] = ['Sale Agreed', 'Documents Pending', 'Payment Processing', 'Paid', 'Vehicle Received', 'Completed'];
const TIMES = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
const PROGRESS = ['Submitted', 'Review', 'Valuation', 'Offer', 'Inspection', 'Sale', 'Purchased'];
const IDLE = /Awaiting|Waiting|complete|Closed/;
const HELP: Partial<Record<Status, string>> = {
  'Submitted': 'New case. Confirm details and photos, then start the valuation.', 'Under Review': 'Check the condition report and photos, then create the valuation.',
  'Valuation In Progress': 'Finish the valuation. A manager must approve before the offer is sent.', 'Valuated': 'Valuation approved. Send the offer to the customer.',
  'Negotiating': 'The customer countered. Create a revised offer or hold.', 'Offer Accepted': 'Customer accepted. Book the inspection (or wait for the customer to book it).',
  'Inspection Completed': 'Review findings and issue the final offer.', 'Final Offer': 'Waiting for the customer to confirm the final offer.',
  'Sale Agreed': 'Collect signed Deed of Sale and original OR/CR, then release payment.', 'Payment Processing': 'Confirm the bank transfer has cleared.', 'Purchased': 'Case complete.',
};

const num = (v: unknown) => +String(v == null ? '' : v).replace(/[^\d]/g, '') || 0;
const money = (n: number) => n ? Math.round(n).toLocaleString('en-PH') : '';
const can = (perm: string) => { const st = DA.S.staff.find(x => x.id === DA.S.session.adminId); return !!st && (DA.S.roles[st.role] || []).includes(perm); };

/** Suggested figures for a new valuation, derived from make averages, age and mileage. */
function suggest(s: Submission) {
  const v = DA.veh(s);
  if (v.make === 'Toyota' && v.model === 'Vios' && v.year === 2022) return { market: 610000, recommended: 570000, maximum: 585000, repair: 12000, recon: 8000, offer: 570000 };
  const avg = (MAKE_SHARE[v.make] || [0, 0, 600000])[2];
  const age = 2026 - v.year, km = v.mileage;
  const market = Math.round(avg * 1.12 * Math.pow(0.92, Math.max(0, age - 4)) * (1 - Math.max(0, km - age * 20000) / 400000) / 5000) * 5000;
  const rec = Math.round(market * 0.93 / 5000) * 5000;
  return { market, recommended: rec, maximum: Math.round(market * 0.96 / 5000) * 5000, repair: 10000, recon: 8000, offer: rec };
}
function initialValuation(s: Submission): ValuationFields {
  const valn = DA.valuationOf(s.id);
  const base = valn || { ...suggest(s), factors: DA.defaultFactors(0), notes: '' };
  return { market: base.market, recommended: base.recommended, maximum: base.maximum, repair: base.repair, recon: base.recon, offer: base.offer, factors: { ...base.factors }, notes: base.notes || '' };
}

export function AdminWorkspace() {
  const S = DA.S, p = S.route.params;
  const s = DA.sub(p.id) || S.submissions[S.submissions.length - 1];
  // Keyed by case so every piece of local form state starts fresh when another case opens.
  return <Workspace key={s.id} s={s} />;
}

function Workspace({ s }: { s: Submission }) {
  const S = DA.S, p = S.route.params;
  const [note, setNote] = useState('');
  const [reply, setReply] = useState('');
  const [vf, setVf] = useState<ValuationFields>(() => initialValuation(s));
  const [dirty, setDirty] = useState(false);
  const [editVeh, setEditVeh] = useState(false);
  const [vehForm, setVehForm] = useState<Record<string, string | number> | null>(null);
  const [lbIndex, setLbIndex] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [om, setOm] = useState<null | { type: OfferType; amount: number; days: number; notes: string }>(null);
  const [insForm, setInsForm] = useState<null | { date: string; time: string; inspector: string; location: string }>(null);
  const [resched, setResched] = useState(false);
  const [finalAmt, setFinalAmt] = useState<number | null>(null);
  const [finalNote, setFinalNote] = useState('');
  const lbRef = useRef<HTMLDivElement>(null);

  const t = p.tab || 'overview';
  const unreadMsgs = t === 'messages' && DA.msgsOf(s.id).some(m => !m.readByAdmin);
  useEffect(() => {
    if (!unreadMsgs) return;
    const tm = setTimeout(() => DA.markRead(s.id, 'admin'), 500);
    return () => clearTimeout(tm);
  }, [unreadMsgs, s.id]);
  const lbOpen = lbIndex >= 0;
  useEffect(() => { if (lbOpen) lbRef.current?.focus(); }, [lbOpen]);

  const v = DA.veh(s), c = DA.cust(s.customerId);
  const cond = S.conditions.find(x => x.submissionId === s.id);
  const own = S.ownerships.find(x => x.submissionId === s.id);
  const offers = DA.offersOf(s.id), o = DA.currentOffer(s.id), valn = DA.valuationOf(s.id), ins = DA.inspectionOf(s.id), sale = DA.saleOf(s.id), photos = DA.photosOf(s.id);
  const na = DA.nextAction(s);
  const me = S.staff.find(x => x.id === S.session.adminId) || S.staff[1];

  const goTab = (k: string) => () => {
    const doGo = () => { setDirty(false); setVf(initialValuation(s)); DA.go('admin', 'workspace', { id: s.id, tab: k }); };
    if (dirty && t === 'valuation' && k !== 'valuation') DA.confirm({ title: 'Discard unsaved valuation?', body: 'You have unsaved changes on the valuation. Leave without saving?', confirmLabel: 'Discard changes', onConfirm: doGo });
    else DA.go('admin', 'workspace', { id: s.id, tab: k });
  };
  const unread = DA.msgsOf(s.id).filter(m => !m.readByAdmin).length;
  const missingReq = REQUIRED_PHOTOS.filter(x => !photos.some(ph => ph.type === x));
  const tabs: [string, string, number?, boolean?][] = [['overview', 'Overview'], ['vehicle', 'Vehicle'], ['condition', 'Condition'], ['photos', 'Photos', photos.length, !!missingReq.length || photos.some(x => x.flagged)], ['documents', 'Documents'], ['valuation', 'Valuation'], ['offers', 'Offers', offers.length], ['messages', 'Messages', unread, !!unread], ['inspection', 'Inspection'], ['sale', 'Sale'], ['activity', 'Activity']];
  const stageIdx = STATUS[s.status][0];
  const reached = stageIdx < 0 ? Math.max(...DA.historyOf(s.id).map(hh => STATUS[hh.status][0])) : stageIdx;
  const nextClick = () => { if (s.status === 'Submitted') { DA.setStatus(s.id, 'Under Review'); DA.toast('Review started · ' + s.ref); return; } goTab(na.tab)(); };
  const badge = DA.badge(s.status);
  const idle = IDLE.test(na.label);
  const canFin = can('View Internal Financial Data');

  /* ---------- overview ---------- */
  const alerts = DA.attention().filter(a => a.subId === s.id);
  const tasks: { label: string; cls: string; onClick: () => void }[] = [];
  if (s.status === 'Submitted') tasks.push({ label: 'Start review', cls: 'btn-primary', onClick: nextClick });
  if (['Submitted', 'Under Review'].includes(s.status)) tasks.push({ label: 'Review photos', cls: 'btn-secondary', onClick: goTab('photos') });
  if (['Under Review', 'Valuation In Progress', 'Valuated', 'Submitted'].includes(s.status)) tasks.push({ label: valn ? 'Open valuation' : 'Create valuation', cls: s.status === 'Submitted' ? 'btn-secondary' : 'btn-primary', onClick: goTab('valuation') });
  if (['Under Review', 'Submitted'].includes(s.status)) tasks.push({ label: 'Request more info', cls: 'btn-ghost', onClick: () => DA.confirm({ title: 'Request more information?', body: 'The customer will see a message and the case moves to More Information Required.', input: 'textarea', inputLabel: 'Message to customer', value: 'Hi ' + c.first + ', could you share a few more details about the car?', confirmLabel: 'Send request', onConfirm: val => { DA.sendMessage(s.id, me.id, val || 'Could you share a few more details?'); DA.setStatus(s.id, 'More Information Required'); DA.toast('Request sent'); } }) });
  if (['Offer Sent', 'Negotiating', 'Final Offer'].includes(s.status)) tasks.push({ label: 'Offer history', cls: 'btn-primary', onClick: goTab('offers') }, { label: 'Message customer', cls: 'btn-secondary', onClick: goTab('messages') });
  if (['Offer Accepted', 'Inspection Scheduled', 'Inspection Completed'].includes(s.status)) tasks.push({ label: 'Go to inspection', cls: 'btn-primary', onClick: goTab('inspection') });
  if (['Sale Agreed', 'Payment Processing', 'Purchased'].includes(s.status)) tasks.push({ label: 'Go to sale', cls: 'btn-primary', onClick: goTab('sale') });
  const nextHelp = s.status === 'Offer Sent' ? (o ? 'Offer of ' + fmt.peso(o.amount) + ' expires ' + fmt.dateTime(o.expires) + '.' : '')
    : s.status === 'Inspection Scheduled' ? (ins && ins.date ? 'Inspection ' + fmt.date(ts(ins.date)) + ' ' + ins.time + ' with ' + DA.staffName(ins.inspector) + '.' : '')
    : HELP[s.status] || '';
  const facts: [string, string, boolean?][] = [['Vehicle', v.year + ' ' + v.make + ' ' + v.model + ' ' + v.variant], ['Customer', c.name + ' · ' + c.phone], ['Submitted', fmt.dateLong(s.submitted) + ' · ' + fmt.time(s.submitted)], ['Current stage', s.status], ['Assigned to', s.assignedTo ? DA.staffName(s.assignedTo) : 'Unassigned'], ['Location', s.location], ['Marketing source', s.source], ['Current offer', o ? fmt.peso(o.amount) + ' · ' + o.status : 'None'], ['Internal market value', canFin ? (valn ? fmt.peso(valn.market) : '—') : 'Restricted', true], ['Recommended / max purchase', canFin ? (valn ? fmt.peso(valn.recommended) + ' / ' + fmt.peso(valn.maximum) : '—') : 'Restricted', true]];
  const caseNotes = S.notes.filter(n => n.submissionId === s.id).sort((a, b) => b.ts - a.ts);

  /* ---------- vehicle ---------- */
  const vform: Record<string, string | number> = vehForm || (v as unknown as Record<string, string | number>);
  const vkeys: [string, string][] = [['Plate', 'plate'], ['Make', 'make'], ['Model', 'model'], ['Variant', 'variant'], ['Year', 'year'], ['Transmission', 'transmission'], ['Fuel', 'fuel'], ['Engine', 'engine'], ['Mileage (km)', 'mileage'], ['Color', 'color']];
  const saveVehicle = () => {
    Object.assign(v, vehForm);
    S.activity.push({ id: uid('a'), ts: now(), user: me.id, action: 'Vehicle edited', record: s.ref, details: 'Vehicle details updated' });
    setEditVeh(false); setVehForm(null); DA.toast('Vehicle details saved');
  };

  /* ---------- condition ---------- */
  type Row = [string, { v?: string; color?: string }] | false | '' | undefined;
  const yn = (x?: string) => ({ v: x || '—', color: x === 'Yes' ? 'var(--color-accent-700)' : 'inherit' });
  const condGroups = ([
    { title: 'Condition report', rows: [['Overall condition', { v: cond?.overall }], ['Accident history', yn(cond?.accident)], cond?.accidentDetails && ['Accident details', { v: cond.accidentDetails }], ['Mechanical problems', yn(cond?.mechanical)], cond?.mechanicalDetails && ['Mechanical details', { v: cond.mechanicalDetails }], ['Warning lights', yn(cond?.warningLights)], ['Service history', { v: cond?.service }], ['Number of keys', { v: cond?.keys }], ['Modifications', yn(cond?.modifications)], cond?.modificationDetails && ['Modification details', { v: cond.modificationDetails }], ['Known damage', { v: cond?.damage || 'None' }], ['Additional info', { v: cond?.info || '—' }]] as Row[] },
    { title: 'Ownership', tag: 'Sensitive', bg: 'var(--color-surface)', pad: '14px 16px', rows: [['Registered owner', { v: own?.registeredOwner }], ['Ownership status', { v: own?.ownershipStatus }], ['Registration', { v: own?.registration }], ['OR/CR', { v: own?.orcr }], ['Documents available', { v: (own?.documents || []).join(', ') }], ['Previous owners', { v: own?.prevOwners || 'Unknown' }], ['Existing financing', yn(own?.financing)], own?.financing === 'Yes' && ['Finance company', { v: own.financeCompany }], own?.financing === 'Yes' && ['Outstanding balance', { v: fmt.peso(own.outstanding), color: 'var(--color-accent-700)' }]] as Row[] },
  ]).map(g => ({ tag: '', bg: 'transparent', pad: '0', ...g, rows: g.rows.filter((r): r is [string, { v?: string; color?: string }] => !!r).map(([k, o2]) => ({ k, v: o2.v || '—', color: o2.color || 'inherit' })) }));

  /* ---------- photos ---------- */
  const allPh = REQUIRED_PHOTOS.concat(OPTIONAL_PHOTOS).map(type => photos.find(x => x.type === type)).filter((x): x is NonNullable<typeof x> => !!x);
  const reqs = (S.photoRequests || []).filter(x => x.submissionId === s.id);
  const requestPhoto = (type: string) => DA.confirm({ title: 'Request a better ' + type.toLowerCase() + ' photo?', body: 'The customer gets a message and a notification with a link to replace it.', input: 'textarea', inputLabel: 'Reason (shown to customer)', value: 'The current photo is blurry or too dark.', confirmLabel: 'Request Better Photo', onConfirm: val => { DA.requestPhoto(s.id, type, val); DA.toast('Photo request sent to ' + c.first); } });
  const cur = lbIndex >= 0 ? allPh[lbIndex] : null;
  const lbGo = (i: number) => { setLbIndex((i + allPh.length) % allPh.length); setZoom(1); };

  /* ---------- documents ---------- */
  const cdocs = (S.documents || []).filter(d => d.submissionId === s.id);
  const docNames = ['Original OR/CR', 'Valid government ID (1 of 2)', 'Valid government ID (2 of 2)'].concat(own?.financing === 'Yes' ? ['Loan payoff statement'] : []);
  const docs = docNames.map(name => {
    const d = cdocs.find(x => x.name === name);
    return { name, meta: d ? d.file + ' · uploaded by customer ' + fmt.dateTime(d.ts) : 'Requested from customer', state: d ? 'Received' : 'Missing', color: d ? 'var(--color-text)' : 'var(--color-accent-700)', canRequest: !d, canView: !!d, request: () => { DA.sendMessage(s.id, me.id, 'Please upload your ' + name + ' from the Documents tab in your account.'); DA.toast('Request sent for ' + name); }, view: () => DA.toast('Opening ' + d?.file + ' (preview not available yet)') };
  }).concat([{ name: 'Deed of Absolute Sale', meta: sale ? 'Generated ' + fmt.date(sale.agreed) + ' · awaiting signatures' : 'Generated when the sale is agreed', state: sale ? (sale.docs['Signed Deed of Sale'] ? 'Signed' : 'Draft ready') : 'Not yet', color: 'var(--color-text)', canRequest: false, canView: !!sale, view: () => DA.toast('Opening deed-of-sale-' + s.ref + '.pdf'), request: () => {} }]);

  /* ---------- valuation ---------- */
  const setV = (k: keyof ValuationFields) => (e: { target: { value: string } }) => { const val = num(e.target.value); setVf(x => ({ ...x, [k]: val })); setDirty(true); };
  const margin = (vf.market || 0) - (vf.offer || 0) - (vf.repair || 0) - (vf.recon || 0);
  const over = vf.offer > vf.maximum;
  const approved = valn?.status === 'Approved';
  const canApprove = can('Approve Valuation'), canSend = can('Send Offer');
  const alreadyOffered = !!o && !['Declined', 'Expired'].includes(o.status);
  const evid: Record<string, string> = { Mileage: fmt.km(v.mileage) + ' · ' + Math.round(v.mileage / Math.max(1, 2026 - v.year)).toLocaleString() + ' km/yr', Condition: (cond?.overall || '—') + ' · ' + (cond?.damage || 'no damage'), 'Accident history': cond?.accident === 'Yes' ? 'Declared' : 'None declared', 'Service history': cond?.service || '—', 'Market demand': v.make + ' ' + v.model + ': ' + (['Vios', 'Innova', 'Fortuner', 'Mirage G4', 'City'].includes(v.model) ? 'high' : 'moderate') + ' demand', 'Vehicle age': (2026 - v.year) + ' years', 'Repair requirements': fmt.peso(vf.repair) + ' estimated' };
  const valFields: [keyof ValuationFields, string][] = [['market', 'Internal estimated market value'], ['recommended', 'Recommended purchase price'], ['maximum', 'Maximum purchase price'], ['repair', 'Repair estimate'], ['recon', 'Reconditioning estimate'], ['offer', 'Recommended customer offer']];
  const comps: [string, number, string, number][] = [[v.year + ' ' + v.make + ' ' + v.model, Math.round(v.mileage * 0.8), 'Auction · Manheim PH', 1.02], [v.year + ' ' + v.make + ' ' + v.model, Math.round(v.mileage * 1.3), 'Dealer trade-in', 0.94], [(v.year - 1) + ' ' + v.make + ' ' + v.model, Math.round(v.mileage * 1.1), BRAND.name + ' purchase', 0.9], [v.year + ' ' + v.make + ' ' + v.model, Math.round(v.mileage * 0.95), 'Retail listing', 1.1]];
  const noApprove = !canApprove || (approved && !dirty);
  const noSend = !canSend || !(approved || canApprove) || (over && !canApprove) || ['Offer Sent', 'Final Offer', 'Offer Accepted', 'Inspection Scheduled', 'Inspection Completed', 'Sale Agreed', 'Payment Processing', 'Purchased'].includes(s.status);
  const sendOffer = () => DA.confirm({
    title: 'Send offer of ' + fmt.peso(vf.offer) + ' to ' + c.first + '?',
    body: 'The customer will be notified by ' + (s.contactPref || 'SMS') + ' and in their portal. Offer valid for ' + S.settings.offerValidity + ' days (until ' + fmt.dateLong(now() + S.settings.offerValidity * 86400e3) + ').\n\nInternal figures stay private.',
    confirmLabel: 'Send Offer',
    onConfirm: () => { DA.saveValuation(s.id, vf, canApprove); DA.sendOffer(s.id, vf.offer, alreadyOffered ? 'Revised Offer' : 'Initial Offer', ''); setDirty(false); DA.toast('Offer sent · ' + fmt.peso(vf.offer)); DA.go('admin', 'workspace', { id: s.id, tab: 'offers' }); },
  });

  /* ---------- offers ---------- */
  const maxAmt = Math.max(1, ...offers.map(x => x.amount));
  const offerBadge = (st: string): CSSProperties => DA.badge(st === 'Accepted' ? 'Offer Accepted' : st === 'Pending' ? 'Offer Sent' : st === 'Declined' ? 'Customer Declined' : 'Draft').style;
  const omWarn = om && valn && om.type !== 'Customer Counter' && om.amount > valn.maximum;

  /* ---------- inspection ---------- */
  const inspectors = S.staff.filter(x => x.role === 'Inspector');
  const insStatus = ins ? ins.status : 'Not Scheduled';
  const canSchedule = ['Offer Accepted', 'Inspection Scheduled'].includes(s.status) || (!!ins && ['Failed', 'Reschedule Required'].includes(ins.status));
  const iform = insForm || { date: fmt.iso(now() + 86400e3), time: '10:00 AM', inspector: inspectors[0]?.id || '', location: s.address || (s.location + ' — customer address') };
  const setI = (k: keyof typeof iform) => (e: { target: { value: string } }) => { const val = e.target.value; setInsForm(f0 => ({ ...(f0 || iform), [k]: val })); };
  const checklist: Record<string, string> = {};
  if (ins) CHECK_AREAS.forEach(a => (checklist[a] = ins.checklist?.[a] || ''));
  const counts: Record<CheckResult, number> = { Pass: 0, Attention: 0, Fail: 0 };
  Object.values(checklist).forEach(x => { if (x in counts) counts[x as CheckResult]++; });
  const deduction = counts.Attention * 15000 + counts.Fail * 40000;
  const baseOffer = o ? (offers.filter(x => x.status === 'Accepted').pop() || o).amount : 0;
  const editable = ins?.status === 'In Progress';
  const insBadge = DA.badge(insStatus === 'Completed' ? 'Inspection Completed' : insStatus === 'Scheduled' ? 'Inspection Scheduled' : insStatus === 'In Progress' ? 'Offer Accepted' : insStatus === 'Failed' ? 'Cancelled' : 'Draft').style;
  const showSchedule = (canSchedule && (!ins || ['Failed', 'Reschedule Required'].includes(ins.status) || s.status === 'Offer Accepted')) || resched;
  const finalValue = finalAmt != null ? finalAmt : baseOffer - deduction;
  const defaultFinalNote = deduction ? (ins?.findings || 'Adjusted after inspection.') : 'Confirmed after inspection — no changes.';
  const completeInspection = () => {
    const missing = CHECK_AREAS.filter(a => !checklist[a]);
    if (missing.length) {
      DA.confirm({ title: 'Mark remaining items as Pass?', body: missing.length + ' checklist items are not set: ' + missing.join(', ') + '.', confirmLabel: 'Mark as Pass & complete', onConfirm: () => { const cl = { ...ins!.checklist }; missing.forEach(a => (cl[a] = 'Pass')); DA.updateInspection(s.id, { checklist: cl }); DA.completeInspection(s.id); DA.toast('Inspection completed'); } });
      return;
    }
    DA.completeInspection(s.id); DA.toast('Inspection completed');
  };

  /* ---------- sale ---------- */
  const pendFinal = !!o && o.type === 'Final Offer' && o.status === 'Pending';
  const si = sale ? SALE_ORDER.indexOf(sale.stage) : -1, nxt = sale ? SALE_ORDER[si + 1] : undefined;
  const pay = sale ? S.payments.find(x => x.saleId === sale.id) : undefined;
  const docsOk = sale ? Object.values(sale.docs).every(Boolean) : false;
  const saleBlocked = nxt === 'Payment Processing' && !docsOk;
  const advance = () => {
    const go = () => { DA.advanceSale(s.id); DA.toast(nxt === 'Completed' ? 'Purchase completed · ' + s.ref + ' marked Purchased' : 'Moved to ' + nxt); };
    if (nxt === 'Paid' || nxt === 'Completed' || nxt === 'Payment Processing') DA.confirm({ title: nxt === 'Payment Processing' ? 'Release payment of ' + fmt.peso(sale!.price) + '?' : nxt === 'Paid' ? 'Confirm payment cleared?' : 'Complete purchase?', body: nxt === 'Completed' ? 'The vehicle will be marked Purchased and included in reporting.' : nxt === 'Paid' ? 'The customer will be notified that payment was processed.' : 'Initiates a bank transfer to the registered owner’s account.', confirmLabel: nxt === 'Completed' ? 'Complete purchase' : 'Confirm', onConfirm: go });
    else go();
  };
  const saleFacts = sale ? ([['Vehicle', v.year + ' ' + v.make + ' ' + v.model + ' · ' + v.plate], ['Customer', c.name], ['Final purchase price', fmt.peso(sale.price)], own?.financing === 'Yes' ? ['Loan settlement (' + own.financeCompany + ')', '− ' + fmt.peso(own.outstanding)] : null, own?.financing === 'Yes' ? ['Net to customer', fmt.peso(sale.price - own.outstanding)] : null, ['Agreement date', fmt.dateLong(sale.agreed)], ['Payment status', pay ? pay.status + ' · ' + pay.method : 'Not started'], ['Payment date', pay && pay.status === 'Paid' ? fmt.dateLong(pay.ts) : '—'], ['Payment reference', pay ? pay.reference : '—'], ['Assigned staff', DA.staffName(sale.staff)], ['Stage', sale.stage]].filter(Boolean) as [string, string][]) : [];

  const activity = DA.historyOf(s.id).map(hh => ({ id: hh.id, ts: hh.ts, user: DA.staffName(hh.by), action: 'Status → ' + hh.status, details: '' }))
    .concat(S.activity.filter(a => a.record === s.ref && a.action !== 'Status changed' && a.action !== 'Vehicle submitted').map(a => ({ id: a.id, ts: a.ts, user: DA.staffName(a.user), action: a.action, details: a.details })))
    .sort((a, b) => b.ts - a.ts);

  const segBtn = (label: string, on: boolean, onClick: () => void, onBg = 'var(--color-text)', extra = '', disabled?: boolean) => (
    <button key={label} onClick={onClick} disabled={disabled} style={{ ...sx('font:inherit;border:0;cursor:pointer;' + extra), background: on ? onBg : 'transparent', color: on ? 'var(--color-bg)' : 'var(--color-text)' }}>{label}</button>
  );

  return (
    <div style={sx('display:flex;flex-direction:column;gap:18px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px')}>
        <button className="btn btn-ghost" onClick={() => DA.go('admin', 'submissions')}>← Vehicle Submissions</button>
        <span style={sx('color:var(--color-neutral-600)')}>/</span>
        <span style={sx('font-weight:700')}>{s.ref}</span>
      </div>
      <div style={sx('display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:flex-start')}>
        <div style={sx('display:flex;flex-direction:column;gap:6px')}>
          <div style={sx('display:flex;gap:12px;align-items:center;flex-wrap:wrap')}>
            <h1 style={sx('font-size:clamp(26px,3vw,36px);margin:0;letter-spacing:-0.02em')}>{v.make + ' ' + v.model + ' ' + v.year}</h1>
            <span style={{ ...badge.style, fontSize: '13px', padding: '5px 10px' }}>{badge.label}</span>
          </div>
          <div style={sx('display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--color-neutral-800)')}>
            <span>{s.ref}</span><span>{v.plate}</span><span>{fmt.km(v.mileage)}</span>
            <span>Customer: <a onClick={() => DA.go('admin', 'customer', { id: c.id })} style={sx('cursor:pointer;font-weight:700')}>{c.name}</a></span>
            <span style={sx('display:flex;gap:6px;align-items:center')}>Assigned:
              <select value={s.assignedTo || ''} onChange={e => { DA.assign(s.id, e.target.value || null); DA.toast('Assigned to ' + (e.target.value ? DA.staffName(e.target.value) : 'nobody')); }} style={sx('font:inherit;font-size:13px;font-weight:700;border:0;border-bottom:1px solid var(--color-divider);background:transparent;padding:0 2px')}>
                <option value="">Unassigned</option>{S.staff.filter(x => ['Valuator', 'Manager', 'Super Admin'].includes(x.role)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </span>
          </div>
        </div>
        <div style={sx('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
          <select value="" onChange={e => {
            const ns = e.target.value as Status; e.target.value = ''; if (!ns) return;
            DA.confirm({ title: 'Change status to “' + ns + '”?', body: 'Manual status changes are logged. Workflow actions (offers, inspections, payments) are safer when available.', input: 'textarea', inputLabel: 'Reason (internal)', confirmLabel: 'Change status', onConfirm: val => { DA.setStatus(s.id, ns); if (val) DA.addNote(s.id, 'Status → ' + ns + ': ' + val); DA.toast('Status changed to ' + ns); } });
          }} className="input" style={sx('width:auto;min-height:36px;font-size:13px')}>
            <option value="">Change status…</option>{STATUS_ORDER.filter(x => x !== s.status && x !== 'Draft').map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <button className={'btn ' + (idle ? 'btn-secondary' : 'btn-primary')} onClick={nextClick} disabled={idle} style={sx('min-height:36px')}>{na.label} →</button>
        </div>
      </div>
      <div style={sx('display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px')}>
        {PROGRESS.map((label, i) => (
          <div key={label} style={sx('display:flex;flex-direction:column;gap:5px;min-width:0')}><div style={{ height: 5, background: i < reached || s.status === 'Purchased' ? 'var(--color-text)' : i === reached && stageIdx >= 0 ? 'var(--color-accent)' : 'var(--color-neutral-300)' }} /><div style={{ ...sx('font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), color: i <= reached ? 'var(--color-text)' : 'var(--color-neutral-600)', fontWeight: i === reached ? 800 : 400 }}>{label}</div></div>
        ))}
      </div>
      <div role="tablist" style={sx('display:flex;overflow-x:auto;border-bottom:2px solid var(--color-divider)')}>
        {tabs.map(([k, label, count, hot]) => (
          <button key={k} role="tab" onClick={goTab(k)} style={{ ...sx('font:inherit;font-size:13.5px;padding:10px 13px;border:0;background:transparent;cursor:pointer;margin-bottom:-2px;display:flex;gap:6px;align-items:center'), borderBottom: '3px solid ' + (t === k ? 'var(--color-accent)' : 'transparent'), color: t === k ? 'var(--color-text)' : 'var(--color-neutral-700)', fontWeight: t === k ? 800 : 400 }}>{label}{!!count && <span style={{ ...sx('color:#fff;font-size:10.5px;padding:0 5px'), background: hot ? 'var(--color-accent-700)' : 'var(--color-neutral-600)' }}>{count}</span>}</button>
        ))}
      </div>

      {t === 'overview' && (
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:28px')}>
          <div style={sx('display:flex;flex-direction:column;gap:24px')}>
            {alerts.length > 0 && (
              <div style={sx('display:flex;flex-direction:column;gap:6px')}>
                {alerts.map((a, i) => <div key={i} style={sx('display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--color-accent-100);color:var(--color-accent-800);border-left:6px solid var(--color-accent);font-size:13.5px')}><strong>{a.kind}</strong><span>{a.detail}</span></div>)}
              </div>
            )}
            <section style={sx('border:2px solid var(--color-text);padding:16px 18px;display:flex;flex-direction:column;gap:10px')}>
              <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);font-weight:600')}>Next action</div>
              <div style={sx('font-weight:800;font-size:20px')}>{na.label}</div>
              <div style={sx('font-size:13.5px;color:var(--color-neutral-800)')}>{nextHelp}</div>
              <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>{tasks.map(x => <button key={x.label} className={'btn ' + x.cls} onClick={x.onClick}>{x.label}</button>)}</div>
            </section>
            <section>
              <h3 style={sx('font-size:17px;margin:0 0 8px')}>Case summary</h3>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));border-top:2px solid var(--color-text)')}>
                {facts.map(([k, val, internal]) => <div key={k} style={sx('display:flex;flex-direction:column;gap:2px;padding:10px 12px 10px 0;border-bottom:1px solid var(--color-divider)')}><span style={{ ...sx('font-size:11px;letter-spacing:0.06em;text-transform:uppercase'), color: internal ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>{internal ? k + ' · internal' : k}</span><span style={sx('font-weight:700;font-size:14px')}>{val}</span></div>)}
              </div>
            </section>
          </div>
          <section style={sx('display:flex;flex-direction:column;gap:12px;background:var(--color-surface);padding:16px 18px;align-self:start')}>
            <div style={sx('display:flex;justify-content:space-between;gap:8px;align-items:baseline')}><h3 style={sx('font-size:17px;margin:0')}>Internal notes</h3><span style={sx('font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;background:var(--color-text);color:var(--color-bg);padding:2px 6px')}>Staff only</span></div>
            <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>Never shown in the customer portal.</div>
            <textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Customer has complete service records." style={sx('min-height:72px;background:var(--color-bg)')} />
            <button className="btn btn-secondary" onClick={() => { DA.addNote(s.id, note.trim()); setNote(''); DA.toast('Internal note added'); }} disabled={!note.trim()} style={sx('align-self:flex-start')}>Add note</button>
            <div style={sx('display:flex;flex-direction:column')}>
              {caseNotes.map(n => <div key={n.id} style={sx('padding:10px 0;border-top:1px solid var(--color-divider);font-size:13.5px')}><div>{n.text}</div><div style={sx('font-size:11px;color:var(--color-neutral-700);margin-top:3px')}>{DA.staffName(n.by)} · {fmt.dateTime(n.ts)}</div></div>)}
              {caseNotes.length === 0 && <div style={sx('font-size:13px;color:var(--color-neutral-700);padding:8px 0')}>No notes yet.</div>}
            </div>
          </section>
        </div>
      )}

      {t === 'vehicle' && (
        <div style={sx('max-width:900px;display:flex;flex-direction:column;gap:12px')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:baseline')}><h3 style={sx('font-size:17px;margin:0')}>Vehicle details</h3><button className="btn btn-secondary" onClick={() => { setVehForm(editVeh ? null : { ...(v as unknown as Record<string, string | number>) }); setEditVeh(!editVeh); }}>{editVeh ? 'Cancel' : 'Edit'}</button></div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:0 28px;border-top:2px solid var(--color-text)')}>
            {vkeys.map(([k, key]) => (
              <div key={key} style={sx('display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider)')}>
                <span style={sx('color:var(--color-neutral-700)')}>{k}</span>
                {!editVeh ? <strong>{key === 'mileage' ? fmt.km(+vform[key]) : String(vform[key] ?? '')}</strong>
                  : <input className="input" value={String(vform[key] ?? '')} onChange={e => { const val = e.target.value; setVehForm(f0 => ({ ...f0, [key]: key === 'mileage' || key === 'year' ? num(val) : val })); }} style={sx('max-width:180px;min-height:30px')} />}
              </div>
            ))}
          </div>
          {editVeh && <button className="btn btn-primary" onClick={saveVehicle} style={sx('align-self:flex-start')}>Save vehicle details</button>}
        </div>
      )}

      {t === 'condition' && (
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:28px')}>
          {condGroups.map(g => (
            <section key={g.title} style={{ background: g.bg, padding: g.pad }}>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px')}><h3 style={sx('font-size:17px;margin:0')}>{g.title}</h3>{g.tag && <span style={sx('font-size:11px;background:var(--color-text);color:var(--color-bg);padding:2px 6px')}>{g.tag}</span>}</div>
              <div style={sx('border-top:2px solid var(--color-text)')}>
                {g.rows.map(r => <div key={r.k} style={sx('display:grid;grid-template-columns:44% 1fr;gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider)')}><span style={sx('color:var(--color-neutral-700)')}>{r.k}</span><span style={{ fontWeight: 700, color: r.color }}>{r.v}</span></div>)}
              </div>
            </section>
          ))}
        </div>
      )}

      {t === 'photos' && (
        <>
          <div style={sx('display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;margin-bottom:4px')}>
            <div style={sx('font-size:13px;color:var(--color-neutral-800)')}>{photos.length + ' photos · ' + (7 - missingReq.length) + ' of 7 required' + (reqs.length ? ' · ' + reqs.length + ' replacement requested' : '')}</div>
            <div style={sx('display:flex;gap:6px;flex-wrap:wrap')}>{missingReq.map(type => <button key={type} className="btn btn-secondary" onClick={() => requestPhoto(type)} style={sx('font-size:12px')}>Request {type}</button>)}</div>
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px')}>
            {allPh.map((x, i) => {
              const requested = reqs.some(r => r.type === x.type);
              return (
                <div key={x.id} style={sx('display:flex;flex-direction:column;gap:6px')}>
                  <button onClick={() => { setLbIndex(i); setZoom(1); }} style={{ ...sx('all:unset;cursor:zoom-in;aspect-ratio:4/3;position:relative;display:grid;place-items:center;overflow:hidden'), background: HATCH, border: x.flagged ? '3px solid var(--color-accent)' : requested ? '3px dashed var(--color-accent)' : '1px solid var(--color-divider)' }}>
                    {x.url ? <img src={x.url} alt={x.type} style={sx('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.08)')} />
                      : <span style={sx('font:600 11px ui-monospace,Menlo,monospace;letter-spacing:0.06em;text-transform:uppercase;background:var(--color-bg);padding:3px 6px;color:var(--color-neutral-700)')}>{x.type}</span>}
                    {x.flagged && <span style={sx('position:absolute;top:6px;left:6px;background:var(--color-accent-700);color:#fff;font-size:10.5px;padding:2px 6px;font-weight:600')}>Flagged</span>}
                  </button>
                  <div style={sx('display:flex;justify-content:space-between;font-size:12.5px;gap:6px')}><strong>{x.type}</strong><span style={sx('color:var(--color-neutral-700)')}>{requested ? 'Requested' : REQUIRED_PHOTOS.includes(x.type) ? 'Required' : 'Optional'}</span></div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {t === 'documents' && (
        <div style={sx('max-width:900px;border-top:2px solid var(--color-text)')}>
          {docs.map(d => (
            <div key={d.name} style={sx('display:grid;grid-template-columns:1fr auto;gap:12px;padding:12px 0;border-bottom:1px solid var(--color-divider);align-items:center')}>
              <div><div style={sx('font-weight:700')}>{d.name}</div><div style={sx('font-size:12px;color:var(--color-neutral-700)')}>{d.meta}</div></div>
              <div style={sx('display:flex;gap:8px;align-items:center')}><span style={{ fontSize: 12, fontWeight: 700, color: d.color }}>{d.state}</span>{d.canRequest && <button className="btn btn-secondary" onClick={d.request} style={sx('font-size:12px')}>Request</button>}{d.canView && <button className="btn btn-ghost" onClick={d.view} style={sx('font-size:12px')}>View</button>}</div>
            </div>
          ))}
        </div>
      )}

      {t === 'valuation' && (!canFin ? (
        <div style={sx('border:2px dashed var(--color-neutral-400);padding:28px;max-width:640px')}><div style={sx('font-weight:800;font-size:18px')}>Internal financial data hidden</div><div style={sx('font-size:14px;color:var(--color-neutral-800);margin-top:4px')}>Your role ({me.role}) does not have “View Internal Financial Data”. Ask a manager to grant it under Staff → Permissions.</div></div>
      ) : (
        <>
          <div style={sx('display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--color-text);color:var(--color-bg);font-size:13px;margin-bottom:4px')}><strong>Internal</strong><span>Valuation figures are never visible to customers. Only the sent offer amount is shared.</span><span style={sx('margin-left:auto')}>{valn ? (valn.status === 'Approved' ? 'Approved by ' + DA.staffName(valn.approvedBy) + ' · ' + fmt.date(valn.ts) : 'Draft by ' + DA.staffName(valn.by) + ' · ' + fmt.date(valn.ts)) : 'Not saved · suggested figures'}</span></div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px')}>
            <section style={sx('display:flex;flex-direction:column;gap:14px')}>
              <div style={sx('display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px')}>
                {valFields.map(([k, label]) => {
                  const isOffer = k === 'offer';
                  const hint = isOffer ? (over ? 'Above maximum purchase price — needs manager approval.' : 'This is the only number the customer sees.') : k === 'market' ? 'From comparable sales and auction data' : '';
                  return (
                    <div key={k} className="field" style={{ gridColumn: isOffer ? '1 / -1' : 'auto' }}>
                      <label style={sx('font-weight:600;color:var(--color-neutral-800)')}>{label}</label>
                      <div style={sx('position:relative')}><span style={sx('position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--color-neutral-700)')}>₱</span><input className="input" inputMode="numeric" value={money(vf[k] as number)} onChange={setV(k)} style={{ ...sx('padding-left:24px;min-height:42px;font-variant-numeric:tabular-nums'), fontSize: isOffer ? '22px' : '15px', fontWeight: isOffer ? 800 : 600, borderColor: isOffer && over ? 'var(--color-accent)' : 'var(--color-divider)' }} /></div>
                      {hint && <div style={{ fontSize: '11.5px', color: isOffer && over ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', marginTop: 4 }}>{hint}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={sx('background:var(--color-surface);padding:14px 16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px')}>
                {[{ k: 'Gross margin', v: fmt.peso(margin), color: margin < 0 ? 'var(--color-accent-700)' : 'var(--color-text)' }, { k: 'Margin %', v: vf.market ? (margin / vf.market * 100).toFixed(1) + '%' : '—', color: 'var(--color-text)' }, { k: 'Headroom to max', v: fmt.peso((vf.maximum || 0) - (vf.offer || 0)), color: over ? 'var(--color-accent-700)' : 'var(--color-text)' }].map(x => <div key={x.k}><div style={sx('font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-neutral-700)')}>{x.k}</div><div style={{ ...sx('font-weight:800;font-size:18px;font-variant-numeric:tabular-nums'), color: x.color }}>{x.v}</div></div>)}
              </div>
              <div className="field"><label style={sx('font-weight:600;color:var(--color-neutral-800)')}>Valuation notes (internal)</label><textarea className="input" value={vf.notes || ''} onChange={e => { const val = e.target.value; setVf(x => ({ ...x, notes: val })); setDirty(true); }} placeholder="Comparable sales, condition adjustments, anything the approver should know." /></div>
              <div style={sx('display:flex;gap:8px;flex-wrap:wrap;border-top:2px solid var(--color-divider);padding-top:14px')}>
                <button className="btn btn-secondary" onClick={() => { DA.saveValuation(s.id, vf, false); setDirty(false); DA.toast('Valuation draft saved'); }}>Save Draft</button>
                <button className="btn btn-secondary" onClick={() => { DA.saveValuation(s.id, vf, true); setDirty(false); DA.toast('Valuation approved at ' + fmt.peso(vf.offer)); }} disabled={noApprove} title={canApprove ? '' : 'Requires “Approve Valuation” permission'}>Approve Valuation</button>
                <button className="btn btn-primary" onClick={sendOffer} disabled={noSend} title={!canSend ? 'Requires “Send Offer” permission' : !(approved || canApprove) ? 'Valuation must be approved first' : ''} style={sx('min-width:160px')}>Send Offer →</button>
                {dirty && <span style={sx('font-size:12px;color:var(--color-accent-700);align-self:center;font-weight:600')}>Unsaved changes</span>}
              </div>
            </section>
            <section style={sx('display:flex;flex-direction:column;gap:20px')}>
              <div>
                <h3 style={sx('font-size:17px;margin:0 0 8px')}>Valuation factors</h3>
                <div style={sx('border-top:2px solid var(--color-text)')}>
                  {Object.keys(vf.factors || {}).map(name => (
                    <div key={name} style={sx('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--color-divider)')}>
                      <div><div style={sx('font-weight:700;font-size:13.5px')}>{name}</div><div style={sx('font-size:11.5px;color:var(--color-neutral-700)')}>{evid[name] || ''}</div></div>
                      <div style={sx('display:flex;border:1px solid var(--color-divider)')}>
                        {(['Positive', 'Neutral', 'Negative'] as FactorImpact[]).map(x => segBtn(x, vf.factors[name] === x, () => { setVf(f0 => ({ ...f0, factors: { ...f0.factors, [name]: x } })); setDirty(true); }, x === 'Negative' ? 'var(--color-accent-700)' : 'var(--color-text)', 'font-size:11.5px;padding:4px 8px'))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 style={sx('font-size:17px;margin:0 0 8px')}>Comparable sales · last 60 days</h3>
                <table className="table" style={sx('font-size:12.5px')}>
                  <thead><tr><th>Vehicle</th><th>Mileage</th><th>Channel</th><th style={sx('text-align:right')}>Price</th></tr></thead>
                  <tbody>{comps.map(([vv, km, ch, k], i) => <tr key={i}><td>{vv}</td><td>{fmt.km(km)}</td><td>{ch}</td><td style={sx('text-align:right;font-weight:700')}>{fmt.peso(Math.round((vf.market || 0) * k / 5000) * 5000)}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ))}

      {t === 'offers' && (
        <>
          <div style={sx('display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center')}>
            <div style={sx('font-size:13px;color:var(--color-neutral-800)')}>Offers are never overwritten. Each change creates a new entry.</div>
            <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
              {o && o.status === 'Pending' && <button className="btn btn-secondary" onClick={() => DA.confirm({ title: 'Record acceptance by phone?', body: c.name + ' accepted ' + fmt.peso(o.amount) + ' by phone. This is logged under your name.', confirmLabel: 'Record acceptance', onConfirm: () => { if (o.type === 'Final Offer') DA.agreeSale(s.id, o.amount); else DA.acceptOffer(s.id); DA.toast('Acceptance recorded'); } })}>Customer accepted by phone</button>}
              <button className="btn btn-primary" onClick={() => setOm({ type: s.status === 'Inspection Completed' ? 'Final Offer' : 'Revised Offer', amount: o ? o.amount : vf.offer, days: S.settings.offerValidity, notes: '' })}>Create Revised Offer</button>
            </div>
          </div>
          {offers.length === 0 && <div style={sx('border:2px dashed var(--color-neutral-400);padding:28px;font-size:14px')}>No offers yet. Create a valuation first, then send the initial offer from the Valuation tab.</div>}
          <div style={sx('display:flex;gap:4px;align-items:flex-end;height:120px;border-bottom:2px solid var(--color-divider);margin:6px 0 2px')}>
            {offers.map(x => (
              <div key={x.id} style={sx('flex:1;max-width:120px;display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:4px')}>
                <div style={sx('font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums')}>{fmt.pesoShort(x.amount)}</div>
                <div style={{ height: (x.amount / maxAmt * 80) + 'px', background: x.byCustomer ? 'transparent' : x.status === 'Accepted' ? 'var(--color-text)' : x === o ? 'var(--color-accent)' : 'var(--color-neutral-400)', border: x.byCustomer ? '2px dashed var(--color-text)' : '0' }} />
              </div>
            ))}
          </div>
          <div style={sx('overflow-x:auto')}>
            <table className="table" style={sx('font-size:13px;min-width:820px')}>
              <thead><tr><th>#</th><th>Type</th><th style={sx('text-align:right')}>Amount</th><th>Created by</th><th>Date</th><th>Expiration</th><th>Status</th><th>Notes</th></tr></thead>
              <tbody>
                {offers.slice().reverse().map((x, i) => (
                  <tr key={x.id} style={{ background: x === o ? 'var(--color-accent-100)' : 'transparent' }}><td>{offers.length - i}</td><td style={sx('font-weight:700;white-space:nowrap')}>{x.type}</td><td style={sx('text-align:right;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap')}>{fmt.peso(x.amount)}</td><td style={sx('white-space:nowrap')}>{DA.staffName(x.by)}</td><td style={sx('white-space:nowrap')}>{fmt.dateTime(x.ts)}</td><td style={sx('white-space:nowrap')}>{x.byCustomer ? '—' : fmt.date(x.expires)}</td><td><span style={offerBadge(x.status)}>{x.status}</span></td><td style={sx('color:var(--color-neutral-800);max-width:280px')}>{x.notes || (x.declineReason ? 'Reason: ' + x.declineReason : '')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {t === 'messages' && (
        <div style={sx('display:flex;flex-direction:column;border:2px solid var(--color-text);max-width:900px')}>
          <div style={sx('padding:12px 16px;border-bottom:2px solid var(--color-divider);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap')}><strong>{c.name} · {c.phone}</strong><span style={sx('font-size:12px;color:var(--color-neutral-700)')}>Prefers {s.contactPref || c.contactPref || 'SMS'}</span></div>
          <div style={sx('padding:16px;display:flex;flex-direction:column;gap:12px;max-height:440px;overflow:auto')}>
            {DA.msgsOf(s.id).map(m => {
              const staff = S.staff.some(x => x.id === m.from);
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: staff ? 'flex-end' : 'flex-start', gap: 3 }}>
                  <div style={{ ...sx('max-width:78%;padding:9px 12px;font-size:13.5px;line-height:1.5'), background: staff ? 'var(--color-text)' : 'var(--color-surface)', color: staff ? 'var(--color-bg)' : 'var(--color-text)' }}>{m.text}{m.attachment && <div style={sx('font-size:11px;margin-top:6px;border-top:1px solid currentColor;padding-top:4px')}>📎 {m.attachment}</div>}</div>
                  <div style={sx('font-size:11px;color:var(--color-neutral-700)')}>{DA.staffName(m.from) + (staff ? '' : ' (customer)')} · {fmt.dateTime(m.ts)}</div>
                </div>
              );
            })}
            {DA.msgsOf(s.id).length === 0 && <div style={sx('font-size:13px;color:var(--color-neutral-700)')}>No messages on this case yet.</div>}
          </div>
          <div style={sx('border-top:2px solid var(--color-divider);padding:10px;display:flex;flex-direction:column;gap:8px')}>
            <div style={sx('display:flex;gap:6px;flex-wrap:wrap')}>{CANNED.map(x => <button key={x} onClick={() => setReply(x)} style={sx('font:inherit;font-size:12px;padding:4px 8px;border:1px solid var(--color-divider);background:var(--color-surface);cursor:pointer;white-space:normal;text-align:left')}>{x}</button>)}</div>
            <textarea className="input" value={reply} onChange={e => setReply(e.target.value)} placeholder="Message the customer (visible to customer)" />
            <div style={sx('display:flex;justify-content:flex-end')}><button className="btn btn-primary" onClick={() => { DA.sendMessage(s.id, me.id, reply.trim()); DA.markRead(s.id, 'admin'); setReply(''); DA.toast('Message sent to ' + c.first); }} disabled={!reply.trim()}>Send</button></div>
          </div>
        </div>
      )}

      {t === 'inspection' && (
        <>
          <div style={sx('display:flex;gap:12px;align-items:center;flex-wrap:wrap')}>
            <span style={sx('font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700)')}>Inspection status</span>
            <span style={insBadge}>{insStatus}</span>
            {ins && <span style={sx('font-size:13px')}>{(ins.date ? fmt.dateLong(ts(ins.date)) : '') + ' · ' + ins.time + ' · ' + DA.staffName(ins.inspector)}</span>}
          </div>
          {!ins && !canSchedule && <div style={sx('border:2px dashed var(--color-neutral-400);padding:24px;font-size:14px;max-width:720px')}>No inspections scheduled. The customer needs to accept an offer first — current status is {badge.label}.</div>}
          {showSchedule && (
            <section style={sx('border:2px solid var(--color-text);padding:18px;max-width:760px;display:flex;flex-direction:column;gap:14px')}>
              <h3 style={sx('font-size:17px;margin:0')}>{ins && ins.status !== 'Completed' ? 'Reschedule inspection' : 'Schedule inspection'}</h3>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px')}>
                <div className="field"><label>Date</label><input className="input" type="date" value={iform.date} onChange={setI('date')} min="2026-09-29" /></div>
                <div className="field"><label>Time</label><select className="input" value={iform.time} onChange={setI('time')}>{TIMES.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
                <div className="field"><label>Inspector</label><select className="input" value={iform.inspector} onChange={setI('inspector')}>{inspectors.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
              </div>
              <div className="field"><label>Location</label><input className="input" value={iform.location} onChange={setI('location')} /></div>
              <div style={sx('display:flex;gap:8px')}><button className="btn btn-primary" onClick={() => { DA.scheduleInspection(s.id, iform); setResched(false); setInsForm(null); DA.toast('Inspection scheduled · ' + fmt.date(ts(iform.date)) + ' ' + iform.time); }}>Schedule inspection</button>{resched && <button className="btn btn-ghost" onClick={() => setResched(false)}>Cancel</button>}</div>
            </section>
          )}
          {ins && ins.status === 'Scheduled' && !resched && (
            <section style={sx('border:2px solid var(--color-text);padding:18px;max-width:760px;display:flex;flex-direction:column;gap:10px')}>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px')}>
                {([['Date', ins.date ? fmt.dateLong(ts(ins.date)) : ''], ['Time', ins.time], ['Inspector', DA.staffName(ins.inspector)], ['Location', ins.location]] as [string, string | undefined][]).map(([k, val]) => <div key={k}><div style={sx('font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-neutral-700)')}>{k}</div><div style={sx('font-weight:700')}>{val}</div></div>)}
              </div>
              <div style={sx('display:flex;gap:8px;flex-wrap:wrap;margin-top:6px')}><button className="btn btn-primary" onClick={() => { DA.startInspection(s.id); DA.toast('Inspection started'); }}>Start inspection</button><button className="btn btn-secondary" onClick={() => { setResched(true); setInsForm({ date: ins.date || '', time: ins.time || '', inspector: ins.inspector || '', location: ins.location || '' }); }}>Reschedule</button></div>
            </section>
          )}
          {ins && ['In Progress', 'Completed', 'Failed'].includes(ins.status) && (
            <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px')}>
              <section>
                <div style={sx('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px')}><h3 style={sx('font-size:17px;margin:0')}>Vehicle checklist</h3><span style={sx('font-size:12px;color:var(--color-neutral-700)')}>{counts.Pass + ' pass · ' + counts.Attention + ' attention · ' + counts.Fail + ' fail'}</span></div>
                <div style={sx('border-top:2px solid var(--color-text)')}>
                  {CHECK_AREAS.map(a => (
                    <div key={a} style={sx('display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--color-divider)')}>
                      <span style={sx('font-weight:600')}>{a}</span>
                      <div style={sx('display:flex;border:1px solid var(--color-divider)')}>
                        {(['Pass', 'Attention', 'Fail'] as CheckResult[]).map(x => segBtn(x, checklist[a] === x, () => DA.updateInspection(s.id, { checklist: { ...ins.checklist, [a]: x } }), x === 'Pass' ? 'var(--color-text)' : 'var(--color-accent-700)', 'font-size:12px;padding:5px 9px', !editable))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section style={sx('display:flex;flex-direction:column;gap:12px')}>
                <div className="field"><label style={sx('font-weight:600')}>Findings</label><textarea className="input" value={ins.findings || ''} onChange={e => DA.updateInspection(s.id, { findings: e.target.value })} disabled={!editable} placeholder="Summary of what the inspector found" /></div>
                <div className="field"><label style={sx('font-weight:600')}>Damage</label><input className="input" value={ins.damage || ''} onChange={e => DA.updateInspection(s.id, { damage: e.target.value })} disabled={!editable} placeholder="e.g. 3cm scratch rear bumper, as disclosed" /></div>
                <div className="field"><label style={sx('font-weight:600')}>Inspector notes (internal)</label><textarea className="input" value={ins.notes || ''} onChange={e => DA.updateInspection(s.id, { notes: e.target.value })} disabled={!editable} style={sx('min-height:64px')} /></div>
                <div className="field"><label style={sx('font-weight:600')}>Inspection photos</label>
                  <div style={sx('display:flex;gap:6px;flex-wrap:wrap;align-items:center')}>
                    {(ins.photos || []).map(x => <div key={x} style={sx('width:72px;height:54px;background:repeating-linear-gradient(135deg,var(--color-neutral-300) 0 1px,var(--color-neutral-200) 1px 8px);display:grid;place-items:center;font-size:9px;font-weight:600;text-transform:uppercase')}>{x}</div>)}
                    {editable && <button className="btn btn-secondary" onClick={() => { const list = ins.photos || []; DA.updateInspection(s.id, { photos: list.concat(['Insp ' + (list.length + 1)]) }); }} style={sx('font-size:12px')}>+ Add photo</button>}
                  </div>
                </div>
                {editable && (
                  <div style={sx('display:flex;gap:8px;flex-wrap:wrap;border-top:2px solid var(--color-divider);padding-top:12px')}>
                    <button className="btn btn-primary" onClick={completeInspection}>Complete inspection</button>
                    <button className="btn btn-secondary" onClick={() => DA.confirm({ title: 'Mark inspection as failed?', body: 'Use this when the car could not be inspected or has undisclosed major issues.', confirmLabel: 'Mark failed', onConfirm: () => { DA.completeInspection(s.id, 'Failed'); DA.toast('Inspection marked failed'); } })}>Mark failed</button>
                    <button className="btn btn-ghost" onClick={() => { DA.completeInspection(s.id, 'Reschedule Required'); DA.toast('Marked reschedule required'); }}>Reschedule required</button>
                  </div>
                )}
              </section>
            </div>
          )}
          {s.status === 'Inspection Completed' && (
            <section style={sx('border-top:6px solid var(--color-accent);background:var(--color-surface);padding:18px;max-width:760px;display:flex;flex-direction:column;gap:12px')}>
              <h3 style={sx('font-size:18px;margin:0')}>Recommend final offer</h3>
              <div style={sx('font-size:13.5px;color:var(--color-neutral-800)')}>{'Accepted offer ' + fmt.peso(baseOffer) + '. Checklist suggests a deduction of ' + fmt.peso(deduction) + ' (' + counts.Attention + ' attention × ₱15,000, ' + counts.Fail + ' fail × ₱40,000).'}</div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end')}>
                <div className="field"><label style={sx('font-weight:600')}>Final offer (₱)</label><input className="input" inputMode="numeric" value={money(finalValue)} onChange={e => setFinalAmt(num(e.target.value))} style={sx('font-size:20px;font-weight:800;min-height:46px')} /></div>
                <div className="field"><label style={sx('font-weight:600')}>Reason shown to customer</label><input className="input" value={finalNote || defaultFinalNote} onChange={e => setFinalNote(e.target.value)} /></div>
              </div>
              <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
                <button className="btn btn-primary" onClick={() => DA.confirm({ title: 'Issue final offer of ' + fmt.peso(finalValue) + '?', body: 'The customer will be asked to confirm the final offer. The previous offer stays in history.', confirmLabel: 'Issue final offer', onConfirm: () => { DA.sendOffer(s.id, finalValue, 'Final Offer', finalNote || defaultFinalNote, 3); DA.toast('Final offer sent · ' + fmt.peso(finalValue)); } })}>Issue final offer →</button>
                <button className="btn btn-secondary" onClick={() => { DA.sendOffer(s.id, baseOffer, 'Final Offer', 'Confirmed after inspection — no changes.', 3); DA.toast('Final offer confirmed at ' + fmt.peso(baseOffer)); }}>Keep {fmt.peso(baseOffer)} as final</button>
              </div>
            </section>
          )}
        </>
      )}

      {t === 'sale' && (!sale ? (
        <div style={sx('border:2px dashed var(--color-neutral-400);padding:24px;max-width:760px;display:flex;flex-direction:column;gap:10px')}>
          <div style={sx('font-weight:800;font-size:18px')}>No purchase record yet</div>
          <div style={sx('font-size:14px;color:var(--color-neutral-800)')}>{pendFinal ? 'Final offer of ' + fmt.peso(o!.amount) + ' is waiting for the customer. If they confirmed by phone, record the agreement here.' : 'A purchase record is created when the customer accepts the final offer.'}</div>
          {pendFinal && <button className="btn btn-primary" onClick={() => DA.confirm({ title: 'Record sale agreement at ' + fmt.peso(o!.amount) + '?', body: 'Creates the purchase record and generates the Deed of Sale.', confirmLabel: 'Record sale', onConfirm: () => { DA.agreeSale(s.id, o!.amount); DA.toast('Sale agreed · purchase record created'); } })} style={sx('align-self:flex-start')}>Record sale agreement at {fmt.peso(o!.amount)}</button>}
        </div>
      ) : (
        <>
          <div style={sx('display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:3px;margin-bottom:4px')}>
            {SALE_ORDER.map((label, i) => <div key={label} style={sx('display:flex;flex-direction:column;gap:5px;min-width:0')}><div style={{ height: 6, background: i < si || sale.stage === 'Completed' ? 'var(--color-text)' : i === si ? 'var(--color-accent)' : 'var(--color-neutral-300)' }} /><div style={{ ...sx('font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), fontWeight: i === si ? 800 : 400, color: i <= si ? 'var(--color-text)' : 'var(--color-neutral-600)' }}>{label}</div></div>)}
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:28px')}>
            <section>
              <h3 style={sx('font-size:17px;margin:0 0 8px')}>Purchase record</h3>
              <div style={sx('border-top:2px solid var(--color-text)')}>
                {saleFacts.map(([k, val]) => <div key={k} style={sx('display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider)')}><span style={sx('color:var(--color-neutral-700)')}>{k}</span><strong style={sx('text-align:right')}>{val}</strong></div>)}
              </div>
              {nxt && <button className="btn btn-primary" onClick={advance} disabled={saleBlocked} style={sx('margin-top:16px;min-width:240px')}>Advance to {nxt} →</button>}
              {saleBlocked && <div style={sx('font-size:12px;color:var(--color-accent-700);margin-top:6px;font-weight:600')}>Tick all documents before releasing payment.</div>}
              {sale.stage === 'Completed' && <div style={sx('margin-top:16px;background:var(--color-text);color:var(--color-bg);padding:14px 16px;font-weight:800')}>Purchased · vehicle received and case closed</div>}
            </section>
            <section>
              <h3 style={sx('font-size:17px;margin:0 0 8px')}>Documents</h3>
              <div style={sx('border-top:2px solid var(--color-text)')}>
                {Object.keys(sale.docs).map(name => (
                  <label key={name} style={sx('display:flex;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--color-divider);cursor:pointer')}><input type="checkbox" checked={sale.docs[name]} onChange={() => DA.toggleDoc(s.id, name)} style={sx('width:18px;height:18px;accent-color:var(--color-accent)')} /><span style={sx('font-weight:600')}>{name}</span><span style={sx('margin-left:auto;font-size:12px;color:var(--color-neutral-700)')}>{sale.docs[name] ? 'Received' : 'Pending'}</span></label>
                ))}
              </div>
            </section>
          </div>
        </>
      ))}

      {t === 'activity' && (
        <div style={sx('max-width:960px;border-top:2px solid var(--color-text)')}>
          {activity.map(a => <div key={a.id} style={sx('display:grid;grid-template-columns:130px 150px minmax(0,1fr);gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider);font-size:13px')}><span style={sx('color:var(--color-neutral-700)')}>{fmt.dateTime(a.ts)}</span><strong>{a.user}</strong><span>{a.action} <span style={sx('color:var(--color-neutral-700)')}>{a.details}</span></span></div>)}
        </div>
      )}

      {cur && (
        <div ref={lbRef} tabIndex={0} onKeyDown={e => { if (e.key === 'ArrowRight') lbGo(lbIndex + 1); if (e.key === 'ArrowLeft') lbGo(lbIndex - 1); if (e.key === 'Escape') { e.stopPropagation(); setLbIndex(-1); } }}
          style={sx('position:fixed;inset:0;z-index:95;background:color-mix(in srgb,var(--color-neutral-900) 92%,transparent);display:flex;flex-direction:column;color:var(--color-bg)')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 18px;flex-wrap:wrap')}>
            <div><strong>{cur.type}</strong> <span style={sx('color:var(--color-neutral-400)')}>· {(lbIndex + 1) + ' / ' + allPh.length} · {'Uploaded ' + fmt.dateTime(cur.uploaded)}</span></div>
            <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
              <button onClick={() => setZoom(z => z === 1 ? 2 : 1)} style={sx('font:inherit;font-size:13px;padding:6px 12px;border:1px solid var(--color-neutral-600);background:transparent;color:var(--color-bg);cursor:pointer')}>Zoom {zoom === 1 ? '2×' : '1×'}</button>
              <button onClick={() => { DA.flagPhoto(cur.id); DA.toast(cur.flagged ? cur.type + ' flagged as poor quality' : 'Flag cleared'); }} style={{ ...sx('font:inherit;font-size:13px;padding:6px 12px;border:1px solid var(--color-neutral-600);color:var(--color-bg);cursor:pointer'), background: cur.flagged ? 'var(--color-accent-700)' : 'transparent' }}>{cur.flagged ? 'Unflag' : 'Flag poor image'}</button>
              <button onClick={() => { setLbIndex(-1); requestPhoto(cur.type); }} style={sx('font:inherit;font-size:13px;padding:6px 12px;border:0;background:var(--color-accent);color:#fff;cursor:pointer;font-weight:700')}>Request Better Photo</button>
              <button onClick={() => setLbIndex(-1)} style={sx('font:inherit;font-size:13px;padding:6px 12px;border:1px solid var(--color-neutral-600);background:transparent;color:var(--color-bg);cursor:pointer')}>Close ✕</button>
            </div>
          </div>
          <div style={sx('flex:1;display:grid;grid-template-columns:64px minmax(0,1fr) 64px;align-items:center;min-height:0')}>
            <button onClick={() => lbGo(lbIndex - 1)} style={sx('font:inherit;font-size:28px;height:100%;border:0;background:transparent;color:var(--color-bg);cursor:pointer')} aria-label="Previous">‹</button>
            <div style={sx('height:100%;overflow:auto;display:grid;place-items:center;padding:12px')}>
              <div style={sx('width:min(100%,900px);aspect-ratio:4/3;position:relative;overflow:hidden;background:repeating-linear-gradient(135deg,var(--color-neutral-700) 0 1px,var(--color-neutral-800) 1px 12px)')}>
                <div style={{ ...sx('position:absolute;inset:0;transform-origin:center;transition:transform .2s;display:grid;place-items:center'), transform: 'scale(' + zoom + ')' }}>
                  {cur.url ? <img src={cur.url} alt={cur.type} style={sx('width:100%;height:100%;object-fit:contain;filter:grayscale(1) contrast(1.08)')} />
                    : <span style={sx('font:600 14px ui-monospace,Menlo,monospace;letter-spacing:0.08em;text-transform:uppercase;border:1px solid var(--color-neutral-500);padding:6px 10px')}>{cur.type} · no image file</span>}
                </div>
              </div>
            </div>
            <button onClick={() => lbGo(lbIndex + 1)} style={sx('font:inherit;font-size:28px;height:100%;border:0;background:transparent;color:var(--color-bg);cursor:pointer')} aria-label="Next">›</button>
          </div>
          <div style={sx('display:flex;gap:6px;padding:10px 18px 16px;overflow-x:auto')}>
            {allPh.map((x, i) => <button key={x.id} onClick={() => lbGo(i)} style={{ ...sx('font:inherit;flex:none;width:84px;height:60px;background:var(--color-neutral-800);color:var(--color-bg);font-size:9.5px;cursor:pointer;text-transform:uppercase;white-space:normal'), border: '2px solid ' + (i === lbIndex ? 'var(--color-accent)' : 'transparent') }}>{x.type}</button>)}
          </div>
        </div>
      )}

      {om && (
        <div className="dialog-backdrop" style={sx('z-index:96')} onClick={() => setOm(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={sx('width:min(520px,100%);border-top:6px solid var(--color-accent)')}>
            <div className="dialog-title">Create revised offer</div>
            <div className="dialog-body">The previous offer stays in history as “Superseded”. {o ? 'Current: ' + fmt.peso(o.amount) + ' (' + o.type + ').' : ''}</div>
            <div className="field"><label>Type</label><div style={sx('display:flex;flex-wrap:wrap;border:1px solid var(--color-divider)')}>{(['Revised Offer', 'Final Offer', 'Customer Counter'] as OfferType[]).map(x => segBtn(x, om.type === x, () => setOm({ ...om, type: x }), 'var(--color-text)', 'font-size:13px;padding:7px 12px'))}</div></div>
            <div style={sx('display:grid;grid-template-columns:2fr 1fr;gap:12px')}>
              <div className="field"><label>Amount (₱)</label><input className="input" inputMode="numeric" value={money(om.amount)} onChange={e => setOm({ ...om, amount: num(e.target.value) })} style={{ ...sx('font-size:20px;font-weight:800;min-height:46px'), borderColor: omWarn ? 'var(--color-accent)' : 'var(--color-divider)' }} />{omWarn && <div style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600;margin-top:4px')}>Above maximum purchase price ({fmt.peso(valn!.maximum)}).</div>}</div>
              <div className="field"><label>Valid for (days)</label><input className="input" inputMode="numeric" value={String(om.days)} onChange={e => setOm({ ...om, days: num(e.target.value) })} style={sx('min-height:46px')} /></div>
            </div>
            <div className="field"><label>Notes</label><textarea className="input" value={om.notes} onChange={e => setOm({ ...om, notes: e.target.value })} placeholder="Why the amount changed (shown to customer for revised/final offers)" /></div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setOm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { if (!om.amount) { DA.toast('Enter an amount'); return; } DA.sendOffer(s.id, om.amount, om.type, om.notes, om.days || S.settings.offerValidity); setOm(null); DA.toast((om.type === 'Customer Counter' ? 'Counter recorded · ' : om.type + ' sent · ') + fmt.peso(om.amount)); }}>{om.type === 'Customer Counter' ? 'Record counter-offer' : 'Send ' + om.type.toLowerCase()}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
