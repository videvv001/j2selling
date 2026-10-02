import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { BRAND, DEMO_MODE } from '../../config';
import { readImageFile } from '../../lib/images';
import { sx } from '../../lib/sx';
import { useWidth } from '../../lib/useWidth';
import {
  CITIES, COLORS, DA, MAKES, OPTIONAL_PHOTOS, REQUIRED_PHOTOS, SOURCES, VARIANTS, fmt, now, type Draft,
} from '../../store';

type Sec = 'vehicle' | 'condition' | 'ownership' | 'contact';
type FieldType = 'text' | 'select' | 'textarea' | 'seg' | 'checks';
interface FieldOpts { req?: 1; placeholder?: string; help?: string; options?: string[]; disabled?: boolean; full?: 1; inputmode?: string; inputType?: string }
type FieldDef = [Sec, string, string, FieldType, FieldOpts];
interface SectionDef { title: string | null; note?: string; sensitive?: 1; fields: (FieldDef | false)[] }

const LABELS = ['Vehicle', 'Condition', 'Ownership', 'Photos', 'Contact', 'Review'];
const TITLES: [string, string][] = [
  ['Tell us about your car', 'Start with the basics. You can go back and change anything before you submit.'],
  ['Vehicle condition', 'Honest answers keep your final offer close to the first one. Minor wear is expected.'],
  ['Ownership information', 'We use this to prepare the paperwork. Financial details are only visible to your valuator.'],
  ['Upload photos', 'Seven required angles. Photos taken in daylight, with the car clean, get the most accurate offers.'],
  ['Contact and vehicle location', 'Where should we send your offer, and where is the car for inspection?'],
  ['Review and submit', 'Check everything once. You can edit any section.'],
];
const HATCH = 'repeating-linear-gradient(135deg,var(--color-neutral-300) 0 1px,var(--color-neutral-200) 1px 9px)';

const clone = (d: Draft): Draft => JSON.parse(JSON.stringify(d));
const val = (d: Draft, sec: Sec, key: string): unknown => (d[sec] as Record<string, unknown>)[key];

/** Step schemas. Conditional fields appear only when the answer they depend on is "Yes". Steps 3 and 5 have custom UIs. */
function schema(d: Draft, loggedIn: boolean): (SectionDef[] | null)[] {
  const v = d.vehicle, c = d.condition, o = d.ownership;
  const yn = ['Yes', 'No'];
  const years = Array.from({ length: 17 }, (_, i) => String(2026 - i));
  return [
    [{ title: null, fields: [
      ['vehicle', 'plate', 'Plate / registration number', 'text', { req: 1, placeholder: 'ABC 1234', help: 'Used to confirm registration details with LTO.' }],
      ['vehicle', 'year', 'Year', 'select', { req: 1, options: years, placeholder: 'Select year' }],
      ['vehicle', 'make', 'Make', 'select', { req: 1, options: Object.keys(MAKES), placeholder: 'Select make' }],
      ['vehicle', 'model', 'Model', 'select', { req: 1, options: v.make ? MAKES[v.make] : [], placeholder: v.make ? 'Select model' : 'Select a make first', disabled: !v.make }],
      ['vehicle', 'variant', 'Variant', 'select', { req: 1, options: v.model ? (VARIANTS[v.model] || VARIANTS._) : [], placeholder: v.model ? 'Select variant' : 'Select a model first', disabled: !v.model }],
      ['vehicle', 'engine', 'Engine', 'text', { placeholder: 'e.g. 1.5L' }],
      ['vehicle', 'transmission', 'Transmission', 'seg', { req: 1, options: ['Manual', 'Automatic', 'CVT'] }],
      ['vehicle', 'fuel', 'Fuel type', 'seg', { req: 1, options: ['Gasoline', 'Diesel', 'Hybrid', 'Electric'] }],
      ['vehicle', 'mileage', 'Mileage (km)', 'text', { req: 1, placeholder: '32,410', inputmode: 'numeric', help: 'As shown on the odometer.' }],
      ['vehicle', 'color', 'Color', 'select', { req: 1, options: COLORS, placeholder: 'Select color' }],
    ] }],
    [{ title: null, fields: [
      ['condition', 'overall', 'Overall condition', 'seg', { req: 1, options: ['Excellent', 'Good', 'Fair', 'Needs work'], full: 1 }],
      ['condition', 'accident', 'Has the car been in an accident?', 'seg', { req: 1, options: yn }],
      ['condition', 'mechanical', 'Any known mechanical problems?', 'seg', { req: 1, options: yn }],
      c.accident === 'Yes' && ['condition', 'accidentDetails', 'Tell us about the accident or repairs.', 'textarea', { req: 1, full: 1, placeholder: 'What happened, what was repaired, and where.' }],
      c.mechanical === 'Yes' && ['condition', 'mechanicalDetails', 'Describe the mechanical problems.', 'textarea', { req: 1, full: 1, placeholder: 'e.g. aircon weak at idle, transmission slips in 2nd gear' }],
      ['condition', 'warningLights', 'Any warning lights on the dashboard?', 'seg', { req: 1, options: yn }],
      ['condition', 'keys', 'Number of keys', 'seg', { req: 1, options: ['1', '2', '3+'] }],
      c.warningLights === 'Yes' && ['condition', 'warningDetails', 'Which warning lights?', 'text', { req: 1, full: 1, placeholder: 'e.g. check engine, ABS' }],
      ['condition', 'service', 'Service history', 'select', { req: 1, options: ['Full dealer history', 'Partial history', 'Independent garage', 'No records'], placeholder: 'Select' }],
      ['condition', 'modifications', 'Any modifications?', 'seg', { req: 1, options: yn }],
      c.modifications === 'Yes' && ['condition', 'modificationDetails', 'List the modifications.', 'text', { req: 1, full: 1 }],
      ['condition', 'damage', 'Known damage (scratches, dents, cracks)', 'text', { full: 1, placeholder: 'e.g. small dent on rear bumper' }],
      ['condition', 'info', 'Anything else we should know?', 'textarea', { full: 1, placeholder: 'Recent repairs, new tires, casa-maintained…' }],
    ] }],
    [{ title: 'Ownership', fields: [
      ['ownership', 'registeredOwner', 'Are you the registered owner?', 'select', { req: 1, options: ['Yes, I am the registered owner', 'No, selling on behalf of the owner', 'Company-owned vehicle'], placeholder: 'Select', full: 1 }],
      ['ownership', 'ownershipStatus', 'Ownership status', 'select', { req: 1, options: ['Fully paid', 'Under financing', 'Company vehicle'], placeholder: 'Select' }],
      ['ownership', 'prevOwners', 'Previous owners (if known)', 'seg', { options: ['1', '2', '3+', 'Not sure'] }],
      ['ownership', 'registration', 'Registration status', 'select', { req: 1, options: ['Registered, up to date', 'Registration expired', 'Not sure'], placeholder: 'Select' }],
      ['ownership', 'orcr', 'OR/CR availability', 'select', { req: 1, options: ['Original available', 'Photocopy only', 'Lost — need replacement', 'Held by the bank'], placeholder: 'Select' }],
      ['ownership', 'documents', 'Documents available', 'checks', { options: ['OR/CR', 'Valid ID', 'Deed of Sale (prior)', 'Service records', 'Release of Chattel Mortgage'], full: 1 }],
    ] }, { title: 'Financing', note: 'Private — only visible to your valuator', sensitive: 1, fields: [
      ['ownership', 'financing', 'Is there an existing car loan?', 'seg', { req: 1, options: yn, full: 1 }],
      o.financing === 'Yes' && ['ownership', 'financeCompany', 'Finance company', 'select', { req: 1, options: ['BDO Auto Loans', 'BPI Auto Loan', 'Metrobank', 'Security Bank', 'Toyota Financial Services', 'PSBank', 'Other'], placeholder: 'Select' }],
      o.financing === 'Yes' && ['ownership', 'outstanding', 'Outstanding balance (₱)', 'text', { req: 1, inputmode: 'numeric', placeholder: '180,000', help: 'We settle this with your bank and pay you the difference.' }],
    ] }],
    null,
    ([{ title: 'Your details', fields: [
      ['contact', 'first', 'First name', 'text', { req: 1 }], ['contact', 'last', 'Last name', 'text', { req: 1 }],
      ['contact', 'email', 'Email', 'text', { req: 1, inputType: 'email', placeholder: 'you@example.com' }], ['contact', 'phone', 'Mobile number', 'text', { req: 1, inputmode: 'tel', placeholder: '0917 555 0124' }],
      ['contact', 'city', 'City', 'select', { req: 1, options: CITIES, placeholder: 'Select city' }],
      ['contact', 'location', 'Where is the car parked?', 'text', { req: 1, placeholder: 'Barangay, street or landmark', help: 'For the inspection visit. Shared only after you accept an offer.' }],
      ['contact', 'pref', 'Preferred contact method', 'seg', { req: 1, options: ['SMS', 'Call', 'Email', 'Viber'], full: 1 }],
      ['contact', 'source', 'How did you hear about us?', 'select', { options: SOURCES, placeholder: 'Select', full: 1 }],
    ] }] as SectionDef[]).concat(loggedIn ? [] : [{ title: 'Create your account', note: 'To track your valuation and receive the offer', sensitive: 1, fields: [
      ['contact', 'password', 'Password', 'text', { req: 1, inputType: 'password', help: 'At least 8 characters.' }],
      ['contact', 'confirm', 'Confirm password', 'text', { req: 1, inputType: 'password' }],
    ] }]),
    null,
  ];
}

function validate(step: number): Record<string, string> {
  const d = DA.S.draft!, loggedIn = !!DA.S.session.customerId, e: Record<string, string> = {};
  if (step === 3) {
    const miss = REQUIRED_PHOTOS.filter(t => !(d.photos[t] && d.photos[t].done));
    if (miss.length) e['photos'] = 'Add the remaining required photos: ' + miss.join(', ') + '.';
    return e;
  }
  const secs = schema(d, loggedIn)[step]; if (!secs) return e;
  secs.forEach(s => s.fields.forEach(f => {
    if (!f) return;
    const [sec, key, , , o] = f;
    const v = val(d, sec, key);
    if (o.req && (!v || (Array.isArray(v) && !v.length) || !String(v).trim())) e[sec + '.' + key] = 'Required';
  }));
  const v = d.vehicle, c = d.contact;
  if (step === 0) {
    const km = +String(v.mileage).replace(/\D/g, '');
    if (v.mileage && (km < 10 || km > 900000)) e['vehicle.mileage'] = 'Enter mileage between 10 and 900,000 km.';
    if (v.plate && !/^[A-Za-z]{2,3}\s?\d{3,4}$|^[A-Za-z]\d{3,4}[A-Za-z]{0,2}$|^\d{4}-?\d+$/.test(v.plate.trim())) e['vehicle.plate'] = 'Use the format on your plate, e.g. ABC 1234.';
  }
  if (step === 4) {
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) e['contact.email'] = 'Enter a valid email address.';
    if (c.phone && !/^(09|\+639)\d{9}$/.test(c.phone.replace(/[\s-]/g, ''))) e['contact.phone'] = 'Enter an 11-digit mobile number starting with 09.';
    if (!loggedIn) {
      if (c.password && c.password.length < 8) e['contact.password'] = 'Use at least 8 characters.';
      if (c.confirm && c.confirm !== c.password) e['contact.confirm'] = 'Passwords don’t match.';
    }
  }
  return e;
}

export function SellWizard() {
  const S = DA.S, page = S.route.page;
  const w = useWidth();
  const [errors, setErrorsState] = useState<Record<string, string>>({});
  const errorsRef = useRef(errors);
  const setErrors = (e: Record<string, string>) => { errorsRef.current = e; setErrorsState(e); };
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const multiRef = useRef<HTMLInputElement>(null);
  const pickType = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    if (!DA.S.draft && DA.S.route.page === 'sell') DA.setDraft(DA.emptyDraft());
    const t = timers.current;
    return () => t.forEach(clearInterval);
  }, []);

  if (page === 'sell-success') return <Success />;
  const d = S.draft;
  if (!d) return <div style={sx('min-height:100vh;background:var(--color-bg)')} />;

  const step = d.step || 0, loggedIn = !!S.session.customerId, wide = w > 720;
  const maxStep = d.maxStep || 0;

  const update = (sec: Sec, key: string, value: unknown) => {
    const dd = clone(DA.S.draft!);
    const target = dd[sec] as Record<string, unknown>;
    target[key] = value;
    if (sec === 'vehicle' && key === 'make') { dd.vehicle.model = ''; dd.vehicle.variant = ''; }
    if (sec === 'vehicle' && key === 'model') dd.vehicle.variant = '';
    if (sec === 'vehicle' && key === 'mileage') dd.vehicle.mileage = String(value).replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    DA.setDraft(dd);
    const k = sec + '.' + key;
    if (errorsRef.current[k]) { const e = { ...errorsRef.current }; delete e[k]; setErrors(e); }
  };
  const setStep = (n: number) => {
    const dd = clone(DA.S.draft!); dd.step = n; dd.maxStep = Math.max(dd.maxStep || 0, n);
    DA.setDraft(dd); setErrors({}); window.scrollTo(0, 0);
  };
  const startUpload = (type: string, url: string | null) => {
    const set = (patch: object) => { const dd = clone(DA.S.draft!); dd.photos[type] = { ...(dd.photos[type] || {}), ...patch }; DA.setDraft(dd); };
    set({ done: false, progress: 0, url: url || null });
    let p = 0;
    const t = setInterval(() => {
      if (!DA.S.draft) { clearInterval(t); return; }
      p = Math.min(100, p + 18 + Math.random() * 20);
      if (p >= 100) { clearInterval(t); set({ done: true, progress: 100 }); if (errorsRef.current.photos) setErrors(validate(3)); }
      else set({ progress: Math.round(p) });
    }, 160);
    timers.current.push(t);
  };
  const handleFiles = (files: FileList | null, forType?: string | null) => {
    const list = Array.from(files || []).filter(f => /^image\//.test(f.type));
    if (!list.length) { DA.toast('Please choose an image file (JPG or PNG).'); return; }
    if (forType) { readImageFile(list[0]).then(url => startUpload(forType, url)); return; }
    const cur = DA.S.draft!;
    const empty = REQUIRED_PHOTOS.concat(OPTIONAL_PHOTOS).filter(t => !(cur.photos[t] && (cur.photos[t].done || cur.photos[t].progress)));
    list.slice(0, empty.length).forEach((f, i) => readImageFile(f).then(url => startUpload(empty[i], url)));
  };

  const steps = LABELS.map((label, i) => ({ label, n: String(i + 1).padStart(2, '0'), locked: i > maxStep, current: i === step, cursor: i <= maxStep ? 'pointer' : 'default', bar: i < step ? 'var(--color-text)' : i === step ? 'var(--color-accent)' : 'var(--color-neutral-300)', color: i === step ? 'var(--color-text)' : 'var(--color-neutral-700)', weight: i === step ? 800 : 400, onClick: () => { if (i <= maxStep) setStep(i); } }));
  const secsSchema = schema(d, loggedIn)[step];
  const cols = wide ? 'repeat(2,minmax(0,1fr))' : 'minmax(0,1fr)';
  const errCount = Object.keys(errors).length;
  const cust = loggedIn ? DA.cust(S.session.customerId) : null;
  const saved = d._saved ? 'Draft saved ' + fmt.ago(d._saved) : 'Draft saved on this device';
  const reqDone = REQUIRED_PHOTOS.filter(t => d.photos[t] && d.photos[t].done).length;

  const exit = () => DA.confirm({ title: 'Leave the valuation?', body: 'Your answers are saved on this device. Pick up where you left off from “Get My Car Valued”.', confirmLabel: 'Save & exit', onConfirm: () => DA.go('public', 'home') });
  const fillDemo = () => {
    const demo = DA.demoDraft(); demo.step = step; demo.maxStep = 5; demo.photos = d.photos;
    if (loggedIn) { const cc = DA.cust(S.session.customerId); Object.assign(demo.contact, { first: cc.first, last: cc.last, email: cc.email, phone: cc.phone, city: cc.city }); }
    DA.setDraft(demo); setErrors({}); DA.toast('Demo vehicle loaded: 2022 Toyota Vios 1.5 G CVT');
  };
  const demoSignIn = () => {
    DA.loginCustomer('c1');
    const dd = clone(DA.S.draft!); const cc = DA.cust('c1');
    Object.assign(dd.contact, { first: cc.first, last: cc.last, email: cc.email, phone: cc.phone, city: cc.city });
    DA.setDraft(dd); DA.toast('Signed in as Juan Dela Cruz');
  };
  const next = () => {
    if (step === 5) {
      if (!agree) { setAgreeError(true); return; }
      for (let i = 0; i < 5; i++) {
        const e = validate(i);
        if (Object.keys(e).length) { setStep(i); setErrors(e); DA.toast('Please complete step ' + (i + 1) + ' first.'); return; }
      }
      setSubmitting(true);
      setTimeout(() => { const ref = DA.submitDraft(); setSubmitting(false); setAgree(false); DA.go('public', 'sell-success'); DA.toast('Submitted · ' + ref); }, 1100);
      return;
    }
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); window.scrollTo(0, 0); return; }
    const dd = clone(d); dd._saved = now(); DA.setDraft(dd);
    setStep(step + 1);
  };

  const slot = (type: string, required: boolean) => {
    const p = d.photos[type] || {}, done = !!p.done, up = !done && p.progress != null && p.progress < 100 && p.progress >= 0;
    return {
      type, star: required ? ' *' : '', done, uploading: up, empty: !done && !up, url: p.url || '', sim: (done || up) && !p.url, progress: p.progress || 0,
      bg: done || up ? HATCH : 'var(--color-bg)',
      border: done ? '2px solid var(--color-text)' : (required && errors.photos && !done ? '2px dashed var(--color-accent)' : '1px dashed var(--color-neutral-500)'),
      onPick: () => { pickType.current = type; fileRef.current?.click(); },
      onRemove: (e: { stopPropagation: () => void }) => { e.stopPropagation(); const dd = clone(DA.S.draft!); delete dd.photos[type]; DA.setDraft(dd); },
      onDrop: (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); handleFiles(e.dataTransfer.files, type); },
    };
  };
  const renderSlot = (p: ReturnType<typeof slot>, required: boolean) => (
    <div key={p.type} onDragOver={e => e.preventDefault()} onDrop={p.onDrop} style={sx('display:flex;flex-direction:column;gap:6px')}>
      <div onClick={p.onPick} style={{ ...sx('aspect-ratio:4/3;position:relative;cursor:pointer;overflow:hidden;display:grid;place-items:center'), border: p.border, background: p.bg }}>
        {p.url && <img src={p.url} alt={p.type} style={sx('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.08)')} />}
        {p.empty && <div style={sx('text-align:center;font-size:12px;color:var(--color-neutral-700);padding:8px')}><div style={sx('font-size:24px;line-height:1;margin-bottom:4px')}>+</div>Add photo</div>}
        {p.sim && <div style={sx('font:600 11px ui-monospace,Menlo,monospace;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-neutral-700);background:var(--color-bg);padding:3px 6px')}>{p.type}</div>}
        {p.uploading && (
          <div style={sx('position:absolute;left:0;right:0;bottom:0;padding:8px;background:color-mix(in srgb,var(--color-bg) 85%,transparent)')}>
            <div style={sx('font-size:11px;margin-bottom:4px')}>Uploading {p.progress}%</div>
            <div style={sx('height:4px;background:var(--color-neutral-300)')}><div style={{ height: '100%', width: p.progress + '%', background: 'var(--color-accent)' }} /></div>
          </div>
        )}
        {p.done && <div style={sx('position:absolute;top:6px;right:6px;width:22px;height:22px;background:var(--color-text);color:var(--color-bg);display:grid;place-items:center;font-size:12px')} aria-label="Uploaded">✓</div>}
      </div>
      <div style={sx('display:flex;justify-content:space-between;align-items:center;gap:4px;font-size:13px')}>
        <span style={sx('font-weight:600')}>{p.type}{required && <span style={sx('color:var(--color-accent-700)')}>{p.star}</span>}</span>
        {p.done && (required ? (
          <span style={sx('display:flex;gap:2px')}>
            <button className="btn btn-ghost" onClick={p.onPick} style={sx('font-size:12px;padding:2px 4px')}>Replace</button>
            <button className="btn btn-ghost" onClick={p.onRemove} style={sx('font-size:12px;padding:2px 4px;color:var(--color-neutral-700)')}>Remove</button>
          </span>
        ) : <button className="btn btn-ghost" onClick={p.onRemove} style={sx('font-size:12px;padding:2px 4px;color:var(--color-neutral-700)')}>Remove</button>)}
      </div>
    </div>
  );

  const v = d.vehicle, c = d.condition, o = d.ownership, ct = d.contact;
  const rows = (pairs: [string, unknown][]) => pairs.filter(x => x && x[1]).map(([k, value]) => ({ k, v: Array.isArray(value) ? value.join(', ') : String(value) }));
  const allPhotos = REQUIRED_PHOTOS.concat(OPTIONAL_PHOTOS).filter(t => d.photos[t] && d.photos[t].done).map(t => ({ type: t, url: d.photos[t].url || '' }));
  const review = [
    { title: 'Vehicle', edit: () => setStep(0), rows: rows([['Plate', v.plate.toUpperCase()], ['Vehicle', [v.year, v.make, v.model].filter(Boolean).join(' ')], ['Variant', v.variant], ['Engine', v.engine], ['Transmission', v.transmission], ['Fuel', v.fuel], ['Mileage', v.mileage ? v.mileage + ' km' : ''], ['Color', v.color]]) },
    { title: 'Condition', edit: () => setStep(1), rows: rows([['Overall', c.overall], ['Accident history', c.accident === 'Yes' ? 'Yes — ' + c.accidentDetails : c.accident], ['Mechanical problems', c.mechanical === 'Yes' ? 'Yes — ' + c.mechanicalDetails : c.mechanical], ['Warning lights', c.warningLights === 'Yes' ? 'Yes — ' + c.warningDetails : c.warningLights], ['Service history', c.service], ['Keys', c.keys], ['Modifications', c.modifications === 'Yes' ? 'Yes — ' + c.modificationDetails : c.modifications], ['Known damage', c.damage], ['Notes', c.info]]) },
    { title: 'Ownership', edit: () => setStep(2), rows: rows([['Registered owner', o.registeredOwner], ['Status', o.ownershipStatus], ['Registration', o.registration], ['OR/CR', o.orcr], ['Documents', o.documents], ['Previous owners', o.prevOwners], ['Existing loan', o.financing === 'Yes' ? o.financeCompany + ' · ₱' + o.outstanding : o.financing]]) },
    { title: 'Photos · ' + allPhotos.length, edit: () => setStep(3), rows: [], photos: allPhotos },
    { title: 'Contact', edit: () => setStep(4), rows: rows([['Name', ct.first + ' ' + ct.last], ['Email', ct.email], ['Mobile', ct.phone], ['City', ct.city], ['Car location', ct.location], ['Contact by', ct.pref], ['Account', loggedIn ? 'Signed in' : 'New account will be created']]) },
  ];

  const segBtn = (x: string, on: boolean, err: boolean, onClick: () => void) => (
    <button key={x} role="radio" aria-checked={on} onClick={onClick} style={{ ...sx('font:inherit;font-size:14px;min-height:44px;padding:8px 14px;cursor:pointer'), border: '1px solid ' + (on ? 'var(--color-text)' : err ? 'var(--color-accent)' : 'var(--color-divider)'), background: on ? 'var(--color-text)' : 'var(--color-bg)', color: on ? 'var(--color-bg)' : 'var(--color-text)', fontWeight: on ? 600 : 400 }}>{x}</button>
  );

  const renderField = (f: FieldDef) => {
    const [secKey, key, label, type, o] = f;
    const value = val(d, secKey, key), k = secKey + '.' + key, err = errors[k];
    const id = 'w-' + key;
    const border = err ? 'var(--color-accent)' : 'var(--color-divider)';
    const onChange = (e: { target: { value: string } }) => update(secKey, key, e.target.value);
    const str = value == null ? '' : String(value);
    return (
      <div key={k} className="field" style={{ gridColumn: o.full || !wide ? '1 / -1' : 'auto', minWidth: 0 }}>
        <label htmlFor={id} style={sx('font-size:13px;color:var(--color-neutral-800);font-weight:600')}>{label}<span style={sx('color:var(--color-accent-700)')}>{o.req ? ' *' : ''}</span></label>
        {type === 'text' && <input id={id} className="input" type={o.inputType || 'text'} inputMode={(o.inputmode || 'text') as 'text'} value={str} onChange={onChange} placeholder={o.placeholder || ''} aria-invalid={!!err} style={{ ...sx('min-height:44px;font-size:15px'), borderColor: border }} />}
        {type === 'select' && (
          <select id={id} className="input" value={str} onChange={onChange} disabled={!!o.disabled} aria-invalid={!!err} style={{ ...sx('min-height:44px;font-size:15px'), borderColor: border }}>
            <option value="">{o.placeholder || ''}</option>
            {(o.options || []).map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        )}
        {type === 'textarea' && <textarea id={id} className="input" value={str} onChange={onChange} placeholder={o.placeholder || ''} style={{ fontSize: 15, borderColor: border }} />}
        {type === 'seg' && <div role="radiogroup" style={sx('display:flex;flex-wrap:wrap;gap:6px')}>{(o.options || []).map(x => segBtn(x, value === x, !!err, () => update(secKey, key, x)))}</div>}
        {type === 'checks' && (
          <div style={sx('display:flex;flex-wrap:wrap;gap:6px')}>
            {(o.options || []).map(x => {
              const arr = (value as string[]) || [], on = arr.includes(x);
              return (
                <button key={x} role="checkbox" aria-checked={on} onClick={() => update(secKey, key, on ? arr.filter(y => y !== x) : arr.concat(x))} style={{ ...sx('font:inherit;font-size:14px;min-height:44px;padding:8px 14px;cursor:pointer;color:var(--color-text);display:flex;gap:8px;align-items:center'), border: '1px solid ' + (on ? 'var(--color-accent)' : 'var(--color-divider)'), background: on ? 'var(--color-accent-100)' : 'var(--color-bg)' }}>
                  <span style={sx('width:14px;height:14px;border:1.5px solid currentColor;display:inline-grid;place-items:center;font-size:10px;line-height:1')}>{on ? '✓' : ''}</span>{x}
                </button>
              );
            })}
          </div>
        )}
        {o.help && <div style={sx('font-size:12px;color:var(--color-neutral-700);margin-top:6px')}>{o.help}</div>}
        {err && <div style={sx('font-size:12px;color:var(--color-accent-700);margin-top:6px;font-weight:600')}>{err}</div>}
      </div>
    );
  };

  return (
    <div style={sx('min-height:100vh;background:var(--color-bg);font-family:var(--font-body);color:var(--color-text)')}>
      <Header onExit={exit}>
        {wide && <span style={sx('font-size:12px;color:var(--color-neutral-700)')}>{saved}</span>}
        {DEMO_MODE && <button className="btn btn-secondary" onClick={fillDemo} title="Prototype helper: loads the sample 2022 Toyota Vios">Fill with demo car</button>}
        <button className="btn btn-ghost" onClick={exit}>Save &amp; exit</button>
      </Header>

      <div style={sx('max-width:880px;margin:0 auto;padding:28px clamp(16px,4vw,40px) 96px')}>
        <div style={sx('display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px;margin-bottom:8px')} role="list" aria-label="Progress">
          {steps.map(s => (
            <button key={s.n} onClick={s.onClick} disabled={s.locked} role="listitem" aria-current={s.current ? 'step' : undefined} style={{ ...sx('all:unset;display:flex;flex-direction:column;gap:8px;min-width:0'), cursor: s.cursor }}>
              <div style={{ height: 6, background: s.bar }} />
              <div style={{ ...sx('display:flex;gap:6px;align-items:baseline;font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis'), fontWeight: s.weight, color: s.color }}><span style={sx('font-variant-numeric:tabular-nums')}>{s.n}</span>{wide && <span>{s.label}</span>}</div>
            </button>
          ))}
        </div>
        <div style={sx('font-size:12px;color:var(--color-neutral-700);margin-bottom:28px')}>Step {step + 1} of 6</div>

        <h1 style={sx('font-size:clamp(30px,4vw,44px);letter-spacing:-0.02em;margin:0 0 8px')}>{TITLES[step][0]}</h1>
        <p style={sx('font-size:16px;line-height:1.6;color:var(--color-neutral-800);margin:0 0 28px;max-width:60ch')}>{TITLES[step][1]}</p>

        {errCount > 0 && <div role="alert" style={sx('border-left:6px solid var(--color-accent);background:var(--color-accent-100);color:var(--color-accent-800);padding:12px 16px;margin-bottom:24px;font-size:14px')}>{errors.photos || (errCount === 1 ? 'One field needs your attention.' : errCount + ' fields need your attention.')}</div>}

        {secsSchema && (
          <>
            {secsSchema.map((sec, si) => (
              <section key={si} style={{ marginBottom: 28, padding: sec.sensitive ? '0 20px 20px' : '0', background: sec.sensitive ? 'var(--color-surface)' : 'transparent', borderTop: '2px solid ' + (sec.title ? 'var(--color-text)' : 'transparent') }}>
                {sec.title && (
                  <div style={sx('display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;padding:14px 0 16px')}>
                    <div style={sx('font-weight:800;font-size:18px')}>{sec.title}</div>
                    {sec.note && <div style={sx('font-size:12px;color:var(--color-neutral-700);display:flex;align-items:center;gap:6px')}><span style={sx('width:8px;height:8px;background:var(--color-text)')} />{sec.note}</div>}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '20px 16px', paddingTop: 0 }}>
                  {sec.fields.map(f => f && renderField(f))}
                </div>
              </section>
            ))}
            {DEMO_MODE && step === 4 && !loggedIn && (
              <div style={sx('display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:16px;border:1px solid var(--color-divider);margin-bottom:28px')}>
                <span style={sx('font-size:14px')}>Already have an account?</span>
                <button className="btn btn-secondary" onClick={demoSignIn}>Sign in as Juan (demo)</button>
              </div>
            )}
            {step === 4 && cust && (
              <div style={sx('padding:14px 16px;background:var(--color-surface);font-size:14px;margin-bottom:28px')}>Signed in as <strong>{cust.name + ' (' + cust.email + ')'}</strong>. This car will be added to your account.</div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); if (!drag) setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
              style={{ ...sx('padding:24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-bottom:24px'), border: '2px dashed ' + (drag ? 'var(--color-accent)' : 'var(--color-neutral-500)'), background: drag ? 'var(--color-accent-100)' : 'var(--color-surface)' }}
            >
              <div>
                <div style={sx('font-weight:800;font-size:17px')}>Drop photos here</div>
                <div style={sx('font-size:13px;color:var(--color-neutral-700)')}>We fill empty required slots in order. JPG or PNG, up to 10 MB each.</div>
              </div>
              <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
                <button className="btn btn-secondary" onClick={() => multiRef.current?.click()}>Choose files</button>
                {DEMO_MODE && <button className="btn btn-primary" onClick={() => REQUIRED_PHOTOS.concat(['Engine bay', 'Wheels']).forEach((t, i) => { if (!(DA.S.draft!.photos[t] && DA.S.draft!.photos[t].done)) setTimeout(() => startUpload(t, null), i * 140); })}>Simulate all uploads</button>}
              </div>
            </div>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;gap:12px;flex-wrap:wrap')}>
              <div style={sx('font-weight:800;font-size:18px')}>Required · {reqDone} of 7</div>
              <div style={sx('flex:1;max-width:260px;height:6px;background:var(--color-neutral-200)')}><div style={{ height: '100%', width: (reqDone / 7 * 100) + '%', background: 'var(--color-accent)' }} /></div>
            </div>
            <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:32px')}>
              {REQUIRED_PHOTOS.map(t => renderSlot(slot(t, true), true))}
            </div>
            <div style={sx('font-weight:800;font-size:18px;margin-bottom:4px')}>Recommended</div>
            <div style={sx('font-size:13px;color:var(--color-neutral-700);margin-bottom:12px')}>Optional, but these usually tighten the offer range.</div>
            <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px')}>
              {OPTIONAL_PHOTOS.map(t => renderSlot(slot(t, false), false))}
            </div>
            <input type="file" accept="image/*" ref={fileRef} onChange={e => { handleFiles(e.target.files, pickType.current); e.target.value = ''; }} style={sx('display:none')} />
            <input type="file" accept="image/*" multiple ref={multiRef} onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} style={sx('display:none')} />
          </>
        )}

        {step === 5 && (
          <>
            {review.map(r => (
              <section key={r.title} style={sx('border-top:2px solid var(--color-text);padding:16px 0 24px')}>
                <div style={sx('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px')}>
                  <div style={sx('font-weight:800;font-size:18px')}>{r.title}</div>
                  <button className="btn btn-ghost" onClick={r.edit}>Edit</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0 32px' }}>
                  {r.rows.map(kv => (
                    <div key={kv.k} style={sx('display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--color-divider);font-size:14px')}><span style={sx('color:var(--color-neutral-700)')}>{kv.k}</span><span style={sx('font-weight:600;text-align:right')}>{kv.v}</span></div>
                  ))}
                </div>
                {r.photos && (
                  <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:4px')}>
                    {r.photos.map(p => (
                      <div key={p.type} style={sx('display:flex;flex-direction:column;gap:4px')}>
                        <div style={{ ...sx('aspect-ratio:4/3;position:relative;overflow:hidden'), background: HATCH }}>{p.url && <img src={p.url} alt={p.type} style={sx('width:100%;height:100%;object-fit:cover;filter:grayscale(1)')} />}</div>
                        <span style={sx('font-size:11px')}>{p.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
            <label style={sx('display:flex;gap:12px;align-items:flex-start;padding:16px;background:var(--color-surface);cursor:pointer;font-size:14px;line-height:1.5;margin-bottom:8px')}>
              <input type="checkbox" checked={agree} onChange={() => { setAgree(a => !a); setAgreeError(false); }} style={sx('width:20px;height:20px;accent-color:var(--color-accent);margin:0;flex:none')} />
              <span>I confirm the details are accurate and I’m authorised to sell this vehicle. {BRAND.name} may contact me about this submission.</span>
            </label>
            {agreeError && <div style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600;margin-bottom:16px')}>Please confirm to continue.</div>}
          </>
        )}

        <div style={sx('display:flex;justify-content:space-between;gap:12px;border-top:2px solid var(--color-divider);padding-top:20px;margin-top:12px;flex-wrap:wrap')}>
          <button className="btn btn-secondary" onClick={() => step === 0 ? DA.go('public', 'home') : setStep(step - 1)} style={sx('min-height:48px;padding:10px 20px;font-size:15px')}>{step === 0 ? 'Cancel' : '← Back'}</button>
          <button className="btn btn-primary" onClick={next} disabled={submitting} style={sx('min-height:48px;padding:10px 20px;font-size:15px;min-width:220px;justify-content:flex-start')}>{step === 5 ? (submitting ? 'Submitting…' : 'Submit for Valuation →') : 'Continue →'}</button>
        </div>
      </div>
    </div>
  );
}

function Header({ onExit, children }: { onExit: () => void; children?: ReactNode }) {
  return (
    <header style={sx('display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:14px clamp(16px,4vw,48px);border-bottom:2px solid var(--color-divider)')}>
      <a onClick={onExit} style={sx('cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;color:var(--color-text);text-decoration:none;margin-right:auto')}><span style={sx('width:12px;height:12px;background:var(--color-accent)')} />{BRAND.name}</a>
      {children}
    </header>
  );
}

function Success() {
  const S = DA.S;
  const s = S.submissions.find(x => x.ref === S.lastSubmitted);
  const nextSteps = [{ n: '01', t: 'Review', d: 'A valuator checks your details and photos. We may message you for a clearer photo.' }, { n: '02', t: 'Offer', d: 'You receive a written offer, valid for 8 days, in your account.' }, { n: '03', t: 'Inspection and payment', d: 'Accept, book an inspection, and get paid by bank transfer.' }];
  return (
    <div style={sx('min-height:100vh;background:var(--color-bg);font-family:var(--font-body);color:var(--color-text)')}>
      <Header onExit={() => DA.go('public', 'home')} />
      <div style={sx('max-width:880px;margin:0 auto;padding:clamp(48px,8vw,112px) clamp(16px,4vw,40px) 96px')}>
        <div style={sx('width:56px;height:56px;background:var(--color-accent);color:var(--color-bg);display:grid;place-items:center;font-size:28px;font-weight:800;margin-bottom:28px')}>✓</div>
        <h1 style={sx('font-size:clamp(36px,5vw,64px);line-height:1.05;letter-spacing:-0.02em;margin:0 0 16px')}>Your car has been submitted.</h1>
        <p style={sx('font-size:18px;line-height:1.6;margin:0 0 32px;max-width:54ch;color:var(--color-neutral-800)')}>{s ? 'We’ve received your ' + DA.vName(s) + '. A valuator will review your details and photos and send your offer, usually within 2 business hours. We’ll notify you by ' + (s.contactPref || 'SMS') + '.' : ''}</p>
        <div style={sx('display:inline-flex;flex-direction:column;gap:4px;border:2px solid var(--color-text);padding:16px 20px;margin-bottom:36px')}>
          <span style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-neutral-700)')}>Reference number</span>
          <span style={sx('font-weight:800;font-size:28px;letter-spacing:0.02em;font-variant-numeric:tabular-nums')}>{S.lastSubmitted || 'CAR-2026-00124'}</span>
        </div>
        <div style={sx('border-top:2px solid var(--color-text);margin-bottom:36px')}>
          {nextSteps.map(n => (
            <div key={n.n} style={sx('display:grid;grid-template-columns:48px 1fr;gap:12px;padding:16px 0;border-bottom:1px solid var(--color-divider)')}><span style={sx('font-weight:800;color:var(--color-accent)')}>{n.n}</span><div><div style={sx('font-weight:800')}>{n.t}</div><div style={sx('font-size:14px;color:var(--color-neutral-800)')}>{n.d}</div></div></div>
          ))}
        </div>
        <div style={sx('display:flex;gap:12px;flex-wrap:wrap')}>
          <button className="btn btn-primary" onClick={() => s ? DA.go('customer', 'vehicle', { id: s.id }) : DA.go('customer', 'dashboard')} style={sx('padding:14px 22px;font-size:16px;min-width:240px;justify-content:flex-start')}>Track My Valuation →</button>
          <button className="btn btn-secondary" onClick={() => { DA.setDraft(DA.emptyDraft()); DA.go('public', 'sell'); }} style={sx('padding:14px 22px;font-size:16px')}>Sell another car</button>
        </div>
      </div>
    </div>
  );
}
