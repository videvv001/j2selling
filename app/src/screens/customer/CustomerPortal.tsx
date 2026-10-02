import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { BRAND } from '../../config';
import { readImageFile } from '../../lib/images';
import { sx } from '../../lib/sx';
import { useWidth } from '../../lib/useWidth';
import {
  ACTIVE, DA, OPTIONAL_PHOTOS, REQUIRED_PHOTOS, STATUS, fmt, manila, now, ts, type Status, type Submission,
} from '../../store';

const HATCH = 'repeating-linear-gradient(135deg,var(--color-neutral-300) 0 1px,var(--color-neutral-200) 1px 9px)';
const CENTRE = `${BRAND.name} Centre · 28 Scout Rallos St., Quezon City`;
const SHORT: Record<string, string> = { 'Under Review': 'Review', 'Valuation': 'Valuation', 'Inspection': 'Inspect', 'Completed': 'Done' };
const CUST_TEXT: Record<Status, string> = { 'Draft': 'Draft', 'Submitted': 'Vehicle submitted', 'Under Review': 'Submission reviewed', 'More Information Required': 'More information requested', 'Valuation In Progress': 'Valuation started', 'Valuated': 'Valuation completed', 'Offer Sent': 'Offer received', 'Negotiating': 'Counter-offer under review', 'Offer Accepted': 'You accepted the offer', 'Inspection Scheduled': 'Inspection scheduled', 'Inspection Completed': 'Inspection completed', 'Final Offer': 'Final offer received', 'Sale Agreed': 'Sale agreed', 'Payment Processing': 'Payment processing', 'Purchased': 'Payment sent · sale complete', 'Customer Declined': 'You declined the offer', 'Company Declined': 'We couldn’t make an offer', 'Expired': 'Offer expired', 'Cancelled': 'Cancelled' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const opt = (on: boolean) => ({ border: '1px solid ' + (on ? 'var(--color-text)' : 'var(--color-divider)'), background: on ? 'var(--color-text)' : 'var(--color-bg)', color: on ? 'var(--color-bg)' : 'var(--color-text)' });
const countPill = (n: number, bold?: boolean) => n ? <span style={{ ...sx('background:var(--color-accent-700);color:#fff;font-size:11px;padding:1px 6px'), fontWeight: bold ? 600 : undefined }}>{n}</span> : null;
const kvRow = (k: string, v: string, pad = '11px') => (
  <div key={k} style={{ ...sx('display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--color-divider);font-size:14px'), padding: pad + ' 0' }}><span style={sx('color:var(--color-neutral-700)')}>{k}</span><span style={sx('font-weight:600;text-align:right')}>{v}</span></div>
);

/** What the customer needs to do next on a car, and which tab does it. */
function needsAction(s: Submission): [string, string] | null {
  const m: Partial<Record<Status, [string, string]>> = { 'Offer Sent': ['Review offer', 'offer'], 'Final Offer': ['Review final offer', 'offer'], 'Offer Accepted': ['Schedule inspection', 'offer'], 'More Information Required': ['Open messages', 'messages'] };
  return m[s.status] || ((DA.S.photoRequests || []).some(x => x.submissionId === s.id) ? ['Replace photo', 'photos'] : null);
}

export function CustomerPortal() {
  const S = DA.S, r = S.route, page = r.page, params = r.params;
  const w = useWidth();
  const wide = w > 860;
  const [filter, setFilter] = useState('All');
  const [msg, setMsg] = useState('');
  const [attach, setAttach] = useState('');
  const [sched, setSched] = useState({ date: '', time: '', place: '' });
  const [rescheduling, setRescheduling] = useState(false);
  const [threadSel, setThreadSel] = useState<string | null>(null);
  const [profDraft, setProfDraft] = useState<null | { first: string; last: string; email: string; phone: string; city: string; contactPref: string }>(null);
  const [pw, setPw] = useState({ cur: '', next: '' });
  const [pwErr, setPwErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const replaceType = useRef<string | null>(null);

  const me = DA.cust(S.session.customerId);
  const mine = S.submissions.filter(s => s.customerId === me.id).sort((a, b) => b.submitted - a.submitted);
  const s = page === 'vehicle' ? (DA.sub(params.id) || mine[0]) : null;
  const threadId = page === 'messages' ? (threadSel || (mine.find(x => DA.msgsOf(x.id).length) || mine[0])?.id) : s?.id;

  // Opening a conversation marks the valuator's messages as read (after a short delay, like a real inbox).
  const readId = page === 'vehicle' && params.tab === 'messages' ? params.id : page === 'messages' ? threadId : null;
  const hasUnread = !!readId && DA.msgsOf(readId).some(m => !m.readByCustomer);
  useEffect(() => {
    if (!readId || !hasUnread) return;
    const t = setTimeout(() => DA.markRead(readId, 'customer'), 600);
    return () => clearTimeout(t);
  }, [readId, hasUnread]);

  const unreadMsgs = S.messages.filter(m => !m.readByCustomer && mine.some(x => x.id === m.submissionId)).length;
  const unreadNotes = S.notifications.filter(n => n.audience === 'customer' && n.customerId === me.id && !n.read).length;
  const navOn = (p: string) => page === p || (p === 'cars' && page === 'vehicle');
  const navItems = ([['Dashboard', 'dashboard'], ['My Cars', 'cars'], ['Messages', 'messages', unreadMsgs], ['Notifications', 'notifications', unreadNotes], ['Profile', 'profile']] as [string, string, number?][])
    .map(([label, p, count]) => ({ label, p, count: count || 0, on: navOn(p) }));

  const steps = (sub: Submission) => DA.customerSteps(sub).map(st => ({
    ...st, short: wide ? st.label : (SHORT[st.label] || st.label),
    bar: st.done ? 'var(--color-text)' : st.current ? 'var(--color-accent)' : 'var(--color-neutral-300)',
    fg: st.todo ? 'var(--color-neutral-600)' : 'var(--color-text)', weight: st.current ? 800 : 400,
    markBg: st.done ? 'var(--color-text)' : st.current ? 'var(--color-accent)' : 'transparent',
    markFg: st.todo ? 'var(--color-neutral-500)' : 'var(--color-bg)',
    markBorder: st.done ? 'var(--color-text)' : st.current ? 'var(--color-accent)' : 'var(--color-neutral-400)',
  }));
  const open = (sub: Submission, tab?: string) => () => DA.go('customer', 'vehicle', { id: sub.id, tab: tab || 'overview' });
  const card = (sub: Submission) => {
    const v = DA.veh(sub), o = DA.currentOffer(sub.id), front = DA.photosOf(sub.id).find(p => p.type === 'Front');
    const showOffer = o && ['Pending', 'Accepted'].includes(o.status) && STATUS[sub.status][0] >= 3;
    return { id: sub.id, name: v.make + ' ' + v.model + ' ' + v.year, plate: v.plate, km: fmt.km(v.mileage), ref: sub.ref, badge: DA.badge(sub.status, true), steps: steps(sub), next: DA.customerNext(sub), offer: showOffer ? fmt.peso(o!.amount) : '', open: open(sub), img: front?.url || '' };
  };
  const active = mine.filter(x => ACTIVE(x.status));
  const actionSub = active.find(x => needsAction(x));
  const na = actionSub ? needsAction(actionSub)! : null;
  const offersReceived = mine.filter(x => DA.offersOf(x.id).some(o => !o.byCustomer)).length;
  const sold = mine.filter(x => x.status === 'Purchased');
  const carList = mine
    .filter(x => filter === 'All' || (filter === 'Active' ? ACTIVE(x.status) : filter === 'Sold' ? x.status === 'Purchased' : !ACTIVE(x.status) && x.status !== 'Purchased'))
    .map(x => { const c = card(x); const sl = DA.saleOf(x.id); const o = DA.currentOffer(x.id); return { ...c, offer: x.status === 'Purchased' && sl ? 'Sold for ' + fmt.peso(sl.price) : (o && STATUS[x.status][0] >= 3 ? 'Offer ' + fmt.peso(o.amount) : '—') }; });

  const send = () => {
    const txt = msg.trim(); if (!txt || !threadId) return;
    DA.sendMessage(threadId, me.id, txt, attach || null); setMsg(''); setAttach(''); DA.toast('Message sent to your valuator');
  };
  const composerKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); };
  const logout = () => DA.confirm({ title: 'Log out?', body: 'You can sign back in any time to track your cars.', confirmLabel: 'Log out', onConfirm: () => { DA.logout('customer'); DA.go('public', 'home'); DA.toast('Logged out'); } });
  const sellAnother = () => { const d = DA.emptyDraft(); Object.assign(d.contact, { first: me.first, last: me.last, email: me.email, phone: me.phone, city: me.city }); DA.setDraft(d); DA.go('public', 'sell'); };
  const toCars = () => DA.go('customer', 'cars');

  const thread = threadId ? (() => {
    const ts0 = DA.sub(threadId), msgs = DA.msgsOf(threadId);
    return {
      with: ts0 && ts0.assignedTo ? DA.staffName(ts0.assignedTo) + ' · Your valuator' : BRAND.name + ' team', title: ts0 ? DA.vName(ts0) + ' · ' + ts0.ref : '',
      msgs: msgs.map(m => { const own = m.from === me.id; return { id: m.id, text: m.text, attachment: m.attachment || '', who: own ? 'You' : DA.staffName(m.from), time: fmt.dateTime(m.ts), unread: !own && !m.readByCustomer ? ' · New' : '', own }; }),
    };
  })() : null;

  const bubbles = (fade: boolean) => thread && thread.msgs.map(m => (
    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.own ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div style={{ ...sx('max-width:82%;padding:10px 14px;font-size:14px;line-height:1.5'), background: m.own ? 'var(--color-text)' : 'var(--color-surface)', color: m.own ? 'var(--color-bg)' : 'var(--color-text)' }}>{m.text}{m.attachment && <div style={{ ...sx('margin-top:8px;font-size:12px;border-top:1px solid currentColor;padding-top:6px'), opacity: fade ? 0.9 : undefined }}>📎 {m.attachment}</div>}</div>
      <div style={sx('font-size:11px;color:var(--color-neutral-700)')}>{m.who} · {m.time}{m.unread}</div>
    </div>
  ));

  const prof = profDraft || { first: me.first, last: me.last, email: me.email, phone: me.phone, city: me.city || '', contactPref: me.contactPref || 'SMS' };
  const setP = (k: keyof typeof prof) => (e: { target: { value: string } }) => { const val = e.target.value; setProfDraft(p => ({ ...(p || prof), [k]: val })); };
  const notes = S.notifications.filter(n => n.audience === 'customer' && n.customerId === me.id).sort((a, b) => b.ts - a.ts);

  return (
    <div style={sx('min-height:100vh;background:var(--color-bg);font-family:var(--font-body);color:var(--color-text)')}>
      <header style={sx('border-bottom:2px solid var(--color-divider);background:var(--color-bg);position:sticky;top:0;z-index:30')}>
        <div style={sx('max-width:1200px;margin:0 auto;padding:12px clamp(16px,4vw,40px);display:flex;align-items:center;gap:20px;flex-wrap:wrap')}>
          <a onClick={() => DA.go('customer', 'dashboard')} style={sx('cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;color:var(--color-text);text-decoration:none;margin-right:auto')}><span style={sx('width:12px;height:12px;background:var(--color-accent)')} />{BRAND.name}</a>
          {wide && (
            <nav style={sx('display:flex;gap:4px;align-items:center')}>
              {navItems.map(n => (
                <button key={n.p} onClick={() => DA.go('customer', n.p)} style={{ ...sx('font:inherit;font-size:14px;padding:8px 12px;border:0;background:transparent;cursor:pointer;display:flex;gap:6px;align-items:center'), color: n.on ? 'var(--color-text)' : 'var(--color-neutral-700)', fontWeight: n.on ? 800 : 400, borderBottom: '3px solid ' + (n.on ? 'var(--color-accent)' : 'transparent') }}>{n.label}{countPill(n.count, true)}</button>
              ))}
              <button onClick={logout} style={sx('font:inherit;font-size:14px;padding:8px 12px;border:0;background:transparent;cursor:pointer;color:var(--color-neutral-700)')}>Logout</button>
            </nav>
          )}
          <button className="btn btn-primary" onClick={sellAnother}>Sell a car</button>
        </div>
        {!wide && (
          <nav style={sx('display:flex;overflow-x:auto;border-top:1px solid var(--color-divider)')}>
            {navItems.map(n => (
              <button key={n.p} onClick={() => DA.go('customer', n.p)} style={{ ...sx('font:inherit;font-size:13px;min-height:48px;padding:0 14px;border:0;background:transparent;cursor:pointer;display:flex;gap:6px;align-items:center'), color: n.on ? 'var(--color-text)' : 'var(--color-neutral-700)', fontWeight: n.on ? 800 : 400, borderBottom: '3px solid ' + (n.on ? 'var(--color-accent)' : 'transparent') }}>{n.label}{countPill(n.count)}</button>
            ))}
            <button onClick={logout} style={sx('font:inherit;font-size:13px;min-height:48px;padding:0 14px;border:0;background:transparent;color:var(--color-neutral-700)')}>Logout</button>
          </nav>
        )}
      </header>

      <main style={sx('max-width:1200px;margin:0 auto;padding:clamp(24px,4vw,48px) clamp(16px,4vw,40px) 96px')}>
        {page === 'dashboard' && (
          <>
            <h1 style={sx('font-size:clamp(32px,4.4vw,52px);letter-spacing:-0.02em;margin:0 0 6px')}>Welcome back, {me.first}</h1>
            <p style={sx('margin:0 0 28px;color:var(--color-neutral-800);font-size:16px')}>{active.length ? 'You have ' + active.length + ' car' + (active.length > 1 ? 's' : '') + ' in progress.' : 'No cars in progress right now.'}</p>
            {actionSub && na && (
              <div style={sx('background:var(--color-accent);color:var(--color-bg);padding:20px 24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-bottom:28px')}>
                <div>
                  <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;margin-bottom:4px')}>Action needed · {DA.vName(actionSub)}</div>
                  <div style={sx('font-weight:800;font-size:22px;line-height:1.25')}>{DA.customerNext(actionSub).title}</div>
                  <div style={sx('font-size:14px;margin-top:4px')}>{DA.customerNext(actionSub).body}</div>
                </div>
                <button className="btn" onClick={open(actionSub, na[1])} style={sx('background:var(--color-bg);color:var(--color-text);padding:12px 18px;min-height:44px')}>{na[0]} →</button>
              </div>
            )}
            <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));border-top:2px solid var(--color-text);margin-bottom:40px')}>
              {[{ label: 'Active submissions', value: active.length, color: 'var(--color-text)' }, { label: 'Offers received', value: offersReceived, color: 'var(--color-accent)' }, { label: 'Vehicles sold', value: sold.length, color: 'var(--color-text)' }].map(x => (
                <div key={x.label} style={sx('padding:18px 20px 20px 0;border-bottom:2px solid var(--color-divider)')}>
                  <div style={sx('font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700)')}>{x.label}</div>
                  <div style={{ ...sx('font-weight:800;font-size:44px;line-height:1.1'), color: x.color }}>{x.value}</div>
                </div>
              ))}
            </div>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px;gap:12px;flex-wrap:wrap')}>
              <h2 style={sx('font-size:24px;margin:0')}>Your cars</h2>
              <button className="btn btn-ghost" onClick={toCars}>All cars →</button>
            </div>
            <div style={sx('display:flex;flex-direction:column;gap:20px')}>
              {(active.length ? active : mine.slice(0, 1)).map(card).map(c => (
                <article key={c.id} style={{ ...sx('background:var(--color-surface);display:grid;gap:0'), gridTemplateColumns: wide ? '260px minmax(0,1fr)' : 'minmax(0,1fr)' }}>
                  <div style={{ ...sx('position:relative;min-height:180px;display:grid;place-items:center'), background: HATCH }}>
                    {c.img ? <img src={c.img} alt={c.name} style={sx('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.08)')} />
                      : <span style={sx('font:600 11px ui-monospace,Menlo,monospace;letter-spacing:0.06em;text-transform:uppercase;background:var(--color-bg);padding:3px 6px;color:var(--color-neutral-700)')}>Front photo</span>}
                  </div>
                  <div style={sx('padding:20px 24px;display:flex;flex-direction:column;gap:16px;min-width:0')}>
                    <div style={sx('display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start')}>
                      <div>
                        <div style={sx('font-weight:800;font-size:22px;line-height:1.2')}>{c.name}</div>
                        <div style={sx('font-size:14px;color:var(--color-neutral-800);margin-top:4px')}>{c.plate} · {c.km} · {c.ref}</div>
                      </div>
                      <span style={c.badge.style}>{c.badge.label}</span>
                    </div>
                    <div style={sx('display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px')}>
                      {c.steps.map(st => (
                        <div key={st.label} style={sx('display:flex;flex-direction:column;gap:6px;min-width:0')}>
                          <div style={{ height: 6, background: st.bar }} />
                          <div style={{ ...sx('font-size:11px;line-height:1.3;overflow:hidden;text-overflow:ellipsis'), color: st.fg, fontWeight: st.weight }}>{st.mark} {st.short}</div>
                        </div>
                      ))}
                    </div>
                    <div style={sx('display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--color-divider);padding-top:14px')}>
                      <div style={sx('font-size:14px')}><strong>{c.next.title}</strong>{c.offer && <> · <span style={sx('color:var(--color-accent-700);font-weight:800')}>{c.offer}</span></>}</div>
                      <button className="btn btn-primary" onClick={c.open} style={sx('min-height:44px;padding:10px 16px')}>View Vehicle</button>
                    </div>
                  </div>
                </article>
              ))}
              {mine.length === 0 && (
                <div style={sx('border:2px dashed var(--color-neutral-400);padding:32px;display:flex;flex-direction:column;gap:12px;align-items:flex-start')}>
                  <div style={sx('font-weight:800;font-size:20px')}>No cars in progress</div>
                  <div style={sx('font-size:14px;color:var(--color-neutral-800)')}>Get a written offer in about two hours.</div>
                  <button className="btn btn-primary" onClick={sellAnother}>Get My Car Valued</button>
                </div>
              )}
            </div>
          </>
        )}

        {page === 'cars' && (
          <>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:20px')}>
              <h1 style={sx('font-size:clamp(30px,4vw,44px);letter-spacing:-0.02em;margin:0')}>My cars</h1>
              <div style={sx('display:flex;border:1px solid var(--color-divider)')}>
                {['All', 'Active', 'Sold', 'Closed'].map(x => <button key={x} onClick={() => setFilter(x)} style={{ ...sx('font:inherit;font-size:13px;padding:8px 14px;min-height:40px;border:0;cursor:pointer'), background: filter === x ? 'var(--color-text)' : 'transparent', color: filter === x ? 'var(--color-bg)' : 'var(--color-text)' }}>{x}</button>)}
              </div>
            </div>
            <div style={sx('border-top:2px solid var(--color-text)')}>
              {carList.map(c => (
                <button key={c.id} onClick={c.open} className="hover-surface-bg" style={{ ...sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;gap:8px 20px;align-items:center;padding:18px 0;border-bottom:1px solid var(--color-divider)'), gridTemplateColumns: wide ? 'minmax(0,2fr) 1fr 1fr auto' : 'minmax(0,1fr) auto' }}>
                  <div><div style={sx('font-weight:800;font-size:17px')}>{c.name}</div><div style={sx('font-size:13px;color:var(--color-neutral-700)')}>{c.ref} · {c.plate}</div></div>
                  <div style={sx('font-size:14px')}>{c.km}</div>
                  <div style={sx('font-size:14px;font-weight:600')}>{c.offer}</div>
                  <div><span style={c.badge.style}>{c.badge.label}</span></div>
                </button>
              ))}
            </div>
            {carList.length === 0 && <p style={sx('padding:32px 0;color:var(--color-neutral-700)')}>No cars match this filter.</p>}
          </>
        )}

        {page === 'vehicle' && s && (
          <VehicleDetail
            s={s} wide={wide} steps={steps(s)} meId={me.id} sched={sched} setSched={setSched}
            rescheduling={rescheduling} setRescheduling={setRescheduling}
            onReplace={type => { replaceType.current = type; fileRef.current?.click(); }}
            askQuestion={() => { setMsg(m => m || 'Is there any room to increase the offer?'); DA.go('customer', 'vehicle', { id: s.id, tab: 'messages' }); setTimeout(() => composerRef.current?.focus(), 100); }}
            messages={thread && (
              <div style={sx('max-width:760px;display:flex;flex-direction:column;border:2px solid var(--color-text)')}>
                <div style={sx('padding:14px 18px;border-bottom:2px solid var(--color-divider);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap')}><strong>{thread.with}</strong><span style={sx('font-size:13px;color:var(--color-neutral-700)')}>Usually replies within 1 hour</span></div>
                <div style={sx('padding:18px;display:flex;flex-direction:column;gap:14px;max-height:480px;overflow:auto;background:var(--color-bg)')}>
                  {bubbles(true)}
                  {thread.msgs.length === 0 && <div style={sx('font-size:14px;color:var(--color-neutral-700)')}>No messages yet. Ask your valuator anything about this car or the offer.</div>}
                </div>
                <div style={sx('border-top:2px solid var(--color-divider);padding:12px;display:flex;flex-direction:column;gap:8px')}>
                  {attach && <div style={sx('font-size:12px;display:flex;gap:8px;align-items:center')}>📎 {attach} <button className="btn btn-ghost" onClick={() => setAttach('')} style={sx('font-size:12px;padding:0 4px')}>Remove</button></div>}
                  <textarea className="input" ref={composerRef} value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={composerKey} placeholder="Is there any room to increase the offer?" style={sx('min-height:72px;font-size:15px')} />
                  <div style={sx('display:flex;justify-content:space-between;gap:8px')}>
                    <button className="btn btn-secondary" onClick={() => attachRef.current?.click()}>Attach file</button>
                    <button className="btn btn-primary" onClick={send} disabled={!msg.trim()} style={sx('min-width:120px')}>Send</button>
                  </div>
                </div>
              </div>
            )}
          />
        )}

        {page === 'messages' && (
          <>
            <h1 style={sx('font-size:clamp(30px,4vw,44px);letter-spacing:-0.02em;margin:0 0 20px')}>Messages</h1>
            <div style={{ ...sx('display:grid;gap:24px;align-items:start'), gridTemplateColumns: wide ? '320px minmax(0,1fr)' : 'minmax(0,1fr)' }}>
              <div style={sx('border-top:2px solid var(--color-text)')}>
                {mine.map(x => {
                  const ms = DA.msgsOf(x.id); const last = ms[ms.length - 1]; const unread = ms.filter(m => !m.readByCustomer).length;
                  return (
                    <button key={x.id} onClick={() => setThreadSel(x.id)} style={{ ...sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;flex-direction:column;gap:4px;padding:14px 12px;border-bottom:1px solid var(--color-divider)'), background: x.id === threadId ? 'var(--color-surface)' : 'transparent' }}>
                      <div style={sx('display:flex;justify-content:space-between;gap:8px')}><strong style={sx('font-size:15px')}>{DA.vName(x)}</strong><span style={sx('font-size:12px;color:var(--color-neutral-700)')}>{last ? fmt.ago(last.ts) : ''}</span></div>
                      <div style={sx('display:flex;justify-content:space-between;gap:8px;align-items:center')}><span style={sx('font-size:13px;color:var(--color-neutral-800);overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{last ? last.text : 'No messages yet'}</span>{countPill(unread)}</div>
                    </button>
                  );
                })}
              </div>
              {thread && (
                <div style={sx('display:flex;flex-direction:column;border:2px solid var(--color-text)')}>
                  <div style={sx('padding:14px 18px;border-bottom:2px solid var(--color-divider);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap')}><strong>{thread.title}</strong><a onClick={() => DA.go('customer', 'vehicle', { id: threadId!, tab: 'messages' })} style={sx('cursor:pointer;font-size:13px')}>View vehicle →</a></div>
                  <div style={sx('padding:18px;display:flex;flex-direction:column;gap:14px;max-height:480px;overflow:auto')}>
                    {bubbles(false)}
                    {thread.msgs.length === 0 && <div style={sx('font-size:14px;color:var(--color-neutral-700)')}>No messages yet.</div>}
                  </div>
                  <div style={sx('border-top:2px solid var(--color-divider);padding:12px;display:flex;flex-direction:column;gap:8px')}>
                    {attach && <div style={sx('font-size:12px')}>📎 {attach}</div>}
                    <textarea className="input" value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={composerKey} placeholder="Write a message…" style={sx('min-height:72px;font-size:15px')} />
                    <div style={sx('display:flex;justify-content:space-between;gap:8px')}><button className="btn btn-secondary" onClick={() => attachRef.current?.click()}>Attach file</button><button className="btn btn-primary" onClick={send} disabled={!msg.trim()} style={sx('min-width:120px')}>Send</button></div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {page === 'notifications' && (
          <>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:20px')}>
              <h1 style={sx('font-size:clamp(30px,4vw,44px);letter-spacing:-0.02em;margin:0')}>Notifications</h1>
              <button className="btn btn-ghost" onClick={() => { DA.readNotifications('customer'); DA.toast('All notifications marked as read'); }}>Mark all as read</button>
            </div>
            <div style={sx('border-top:2px solid var(--color-text);max-width:800px')}>
              {notes.map(n => (
                <button key={n.id} className="hover-surface-bg" onClick={() => {
                  n.read = true;
                  if (n.submissionId && DA.sub(n.submissionId)) DA.go('customer', 'vehicle', { id: n.submissionId, tab: /offer/i.test(n.text) ? 'offer' : /message/i.test(n.text) ? 'messages' : /photo/i.test(n.text) ? 'photos' : 'overview' });
                  else DA.go('customer', 'dashboard');
                }} style={sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:14px 1fr auto;gap:12px;align-items:baseline;padding:16px 0;border-bottom:1px solid var(--color-divider)')}>
                  <span style={{ width: 10, height: 10, background: n.read ? 'var(--color-neutral-300)' : 'var(--color-accent)' }} />
                  <span style={{ fontSize: 15, fontWeight: n.read ? 400 : 800 }}>{n.text}</span>
                  <span style={sx('font-size:12px;color:var(--color-neutral-700)')}>{fmt.ago(n.ts)}</span>
                </button>
              ))}
            </div>
            {notes.length === 0 && <p style={sx('color:var(--color-neutral-700)')}>You’re all caught up.</p>}
          </>
        )}

        {page === 'profile' && (
          <>
            <h1 style={sx('font-size:clamp(30px,4vw,44px);letter-spacing:-0.02em;margin:0 0 24px')}>Profile</h1>
            <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:40px;max-width:960px')}>
              <section style={sx('display:flex;flex-direction:column;gap:14px')}>
                <h3 style={sx('font-size:18px;margin:0;border-top:2px solid var(--color-text);padding-top:12px')}>Personal details</h3>
                {([['first', 'First name'], ['last', 'Last name'], ['email', 'Email'], ['phone', 'Mobile number'], ['city', 'City']] as [keyof typeof prof, string][]).map(([k, label]) => (
                  <div key={k} className="field"><label style={sx('font-weight:600')}>{label}</label><input className="input" value={prof[k]} onChange={setP(k)} style={sx('min-height:44px;font-size:15px')} /></div>
                ))}
                <div className="field"><label style={sx('font-weight:600')}>Preferred contact</label>
                  <div style={sx('display:flex;flex-wrap:wrap;gap:6px')}>{['SMS', 'Call', 'Email', 'Viber'].map(x => <button key={x} onClick={() => setProfDraft(p => ({ ...(p || prof), contactPref: x }))} style={{ ...sx('font:inherit;font-size:14px;min-height:44px;padding:8px 14px;cursor:pointer'), ...opt(prof.contactPref === x) }}>{x}</button>)}</div>
                </div>
                <button className="btn btn-primary" onClick={() => { if (!/^\S+@\S+\.\S+$/.test(prof.email)) { DA.toast('Enter a valid email address'); return; } DA.updateCustomer(me.id, prof); setProfDraft(null); DA.toast('Profile saved'); }} style={sx('align-self:flex-start;min-height:44px')}>Save changes</button>
              </section>
              <section style={sx('display:flex;flex-direction:column;gap:14px')}>
                <h3 style={sx('font-size:18px;margin:0;border-top:2px solid var(--color-text);padding-top:12px')}>Password</h3>
                <div className="field"><label style={sx('font-weight:600')}>Current password</label><input className="input" type="password" value={pw.cur} onChange={e => setPw({ ...pw, cur: e.target.value })} style={sx('min-height:44px')} /></div>
                <div className="field"><label style={sx('font-weight:600')}>New password</label><input className="input" type="password" value={pw.next} onChange={e => { setPw({ ...pw, next: e.target.value }); setPwErr(''); }} style={sx('min-height:44px')} />{pwErr && <div style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600;margin-top:6px')}>{pwErr}</div>}</div>
                <button className="btn btn-secondary" onClick={() => { if (!pw.cur) { setPwErr('Enter your current password.'); return; } if (pw.next.length < 8) { setPwErr('New password must be at least 8 characters.'); return; } setPw({ cur: '', next: '' }); DA.toast('Password updated'); }} style={sx('align-self:flex-start;min-height:44px')}>Update password</button>
                <h3 style={sx('font-size:18px;margin:16px 0 0;border-top:2px solid var(--color-text);padding-top:12px')}>Payout account</h3>
                <div style={sx('font-size:14px;line-height:1.6')}>BPI Savings ••4410 · {me.name}<br /><span style={sx('color:var(--color-neutral-700)')}>Payments are only sent to accounts in the registered owner’s name.</span></div>
              </section>
            </div>
          </>
        )}
      </main>
      <input type="file" accept="image/*" ref={fileRef} onChange={e => {
        const file = e.target.files?.[0]; const type = replaceType.current; e.target.value = '';
        if (!file || !s || !type) return;
        readImageFile(file).then(url => { DA.uploadPhoto(s.id, type, url); DA.toast(type + ' photo uploaded'); });
      }} style={sx('display:none')} />
      <input type="file" ref={attachRef} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) setAttach(file.name); }} style={sx('display:none')} />
    </div>
  );
}

interface VehicleProps {
  s: Submission; wide: boolean; meId: string; steps: (ReturnType<typeof DA.customerSteps>[number] & { weight: number; fg: string; markBg: string; markFg: string; markBorder: string })[];
  sched: { date: string; time: string; place: string }; setSched: (s: { date: string; time: string; place: string }) => void;
  rescheduling: boolean; setRescheduling: (b: boolean) => void;
  onReplace: (type: string) => void; askQuestion: () => void; messages: ReactNode;
}

function VehicleDetail({ s, wide, steps, sched, setSched, rescheduling, setRescheduling, onReplace, askQuestion, messages }: VehicleProps) {
  const S = DA.S, params = S.route.params;
  const v = DA.veh(s);
  const cond = S.conditions.find(c => c.submissionId === s.id);
  const own = S.ownerships.find(c => c.submissionId === s.id);
  const t = params.tab || 'overview';
  const unread = DA.msgsOf(s.id).filter(m => !m.readByCustomer).length;
  const tabs = ([['overview', 'Overview'], ['details', 'Vehicle Details'], ['photos', 'Photos'], ['offer', 'Offer'], ['messages', 'Messages', unread], ['documents', 'Documents'], ['activity', 'Activity']] as [string, string, number?][]);
  const hasOffer = DA.offersOf(s.id).length > 0;
  const hist = DA.historyOf(s.id).filter(h => h.status !== 'Valuated' || hasOffer);
  const tl = hist.map((h, i) => ({ id: h.id, date: fmt.date(h.ts), text: CUST_TEXT[h.status] || h.status, dot: i === hist.length - 1 ? 'var(--color-accent)' : 'var(--color-text)' }));
  const o = DA.currentOffer(s.id);
  const reqs = (S.photoRequests || []).filter(x => x.submissionId === s.id);
  const na2 = needsAction(s);
  const sale = DA.saleOf(s.id);
  const docsUp = (S.documents || []).filter(d => d.submissionId === s.id);
  const docDef = ([
    ['Original OR/CR', 'Official Receipt and Certificate of Registration — upload a photo now, bring the originals to signing.'],
    ['Valid government ID (1 of 2)', 'Driver’s licence, passport, UMID or PhilSys ID of the registered owner.'],
    ['Valid government ID (2 of 2)', 'A second ID with signature.'],
    own?.financing === 'Yes' ? ['Loan payoff statement', 'From ' + (own.financeCompany || 'your bank') + '. We settle the balance directly.'] : null,
    ['Deed of Absolute Sale', `Prepared by ${BRAND.name} after the sale is agreed. Signed at handover.`, true],
  ].filter(Boolean) as [string, string, boolean?][]);
  const badge = DA.badge(s.status, true);
  const next = DA.customerNext(s);
  const facts: [string, string][] = [['Reference', s.ref], ['Submitted', fmt.dateLong(s.submitted)], ['Status', badge.label], ['Current offer', o && STATUS[s.status][0] >= 3 ? fmt.peso(o.amount) : 'Not yet'], ['Your valuator', s.assignedTo ? DA.staffName(s.assignedTo) : 'Being assigned'], ['Car location', s.address || s.location], ['Photos', DA.photosOf(s.id).length + ' uploaded']];
  const detailGroups = [
    { title: 'Vehicle', rows: [['Plate', v.plate], ['Make', v.make], ['Model', v.model], ['Variant', v.variant], ['Year', v.year], ['Transmission', v.transmission], ['Fuel', v.fuel], ['Engine', v.engine], ['Mileage', fmt.km(v.mileage)], ['Color', v.color]] },
    { title: 'Condition', rows: [['Overall', cond?.overall], ['Accident history', cond?.accident], ['Mechanical problems', cond?.mechanical], ['Warning lights', cond?.warningLights], ['Service history', cond?.service], ['Keys', cond?.keys], ['Modifications', cond?.modifications], ['Known damage', cond?.damage || 'None']] },
    { title: 'Ownership', rows: [['Registered owner', own?.registeredOwner], ['Status', own?.ownershipStatus], ['Registration', own?.registration], ['OR/CR', own?.orcr], ['Existing loan', own?.financing === 'Yes' ? own.financeCompany + ' · ' + fmt.peso(own.outstanding) : 'No']] },
  ].map(g => ({ title: g.title, rows: g.rows.filter(x => x[1]).map(([k, val]) => ({ k: String(k), v: String(val) })) }));

  const offers = DA.offersOf(s.id);
  const pendingOffer = !!o && o.status === 'Pending' && ['Offer Sent', 'Final Offer'].includes(s.status);
  const ins = DA.inspectionOf(s.id);
  const isFinal = o?.type === 'Final Offer';
  const prevAccepted = offers.filter(x => !x.byCustomer && x.status === 'Accepted' && x !== o).pop();
  const offerStatus: Partial<Record<Status, string>> = { 'Offer Accepted': 'Offer Accepted', 'Inspection Scheduled': 'Offer Accepted · Inspection booked', 'Inspection Completed': 'Inspection complete', 'Sale Agreed': 'Sale Agreed', 'Payment Processing': 'Payment processing', 'Purchased': 'Sold · paid', 'Customer Declined': 'Declined' + (o?.declineReason ? ' — ' + o.declineReason : ''), 'Negotiating': 'Counter-offer under review', 'Expired': 'Expired' };
  const statusText = !pendingOffer && o ? offerStatus[s.status] || '' : '';
  const validity = o ? (pendingOffer ? 'Offer valid until ' + fmt.dateLong(o.expires) + '.' : o.status === 'Accepted' ? 'Accepted on ' + fmt.dateLong(o.acceptedAt || now()) + '.' : o.status === 'Declined' ? 'You declined this offer.' : o.status === 'Expired' ? 'This offer expired on ' + fmt.dateLong(o.expires) + '.' : 'Updated ' + fmt.dateLong(o.ts)) : '';
  const note = isFinal && o?.notes ? (prevAccepted && prevAccepted.amount !== o.amount ? 'Changed from ' + fmt.peso(prevAccepted.amount) + ': ' : '') + o.notes : '';
  const showSchedule = s.status === 'Offer Accepted' || (s.status === 'Inspection Scheduled' && rescheduling);
  const showInspection = ins && ['Inspection Scheduled', 'Inspection Completed', 'Final Offer', 'Sale Agreed', 'Payment Processing', 'Purchased'].includes(s.status) && !rescheduling;

  // Next six days, skipping Sundays (Manila calendar).
  const days: number[] = []; let d0 = now() + 86400e3;
  while (days.length < 6) { if (manila(d0).getUTCDay() !== 0) days.push(d0); d0 += 86400e3; }
  const addr = s.address || (s.location + ' — your address');
  const places = ['At my address · ' + addr, CENTRE];
  const confirmSchedule = () => {
    const location = sched.place.startsWith('At my address · ') ? sched.place.slice('At my address · '.length) : sched.place.replace(`${BRAND.name} Centre · `, '');
    DA.scheduleInspection(s.id, { date: sched.date, time: sched.time, location, inspector: 's3' }, true);
    setRescheduling(false); setSched({ date: '', time: '', place: '' });
    DA.toast('Inspection booked for ' + fmt.date(ts(sched.date)) + ', ' + sched.time);
  };
  const acceptOffer = () => {
    const cur = DA.currentOffer(s.id)!;
    DA.confirm({ title: 'Accept offer of ' + fmt.peso(cur.amount) + '?', body: (cur.type === 'Final Offer' ? 'This confirms the sale. We’ll prepare the Deed of Sale and arrange payment by bank transfer.' : 'Next, you’ll book a 45-minute inspection. The final price is confirmed after inspection.') + '\n\nYou can still message your valuator at any time.', confirmLabel: 'Accept Offer', onConfirm: () => { DA.acceptOffer(s.id); DA.toast(cur.type === 'Final Offer' ? 'Sale agreed at ' + fmt.peso(cur.amount) : 'Offer accepted · Schedule your inspection'); } });
  };
  const declineOffer = () => DA.confirm({ title: 'Decline this offer?', body: 'We’ll close this submission. You can resubmit your car at any time.', input: 'textarea', inputLabel: 'Reason (optional)', placeholder: 'e.g. I got a higher offer elsewhere', confirmLabel: 'Decline Offer', onConfirm: val => { DA.declineOffer(s.id, val); DA.toast('Offer declined'); } });

  return (
    <>
      <button className="btn btn-ghost" onClick={() => DA.go('customer', 'cars')} style={sx('margin-bottom:16px')}>← My cars</button>
      <div style={sx('display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-bottom:20px')}>
        <div>
          <div style={sx('font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700);margin-bottom:6px')}>Reference {s.ref}</div>
          <h1 style={sx('font-size:clamp(30px,4.2vw,48px);letter-spacing:-0.02em;margin:0 0 6px')}>{v.year + ' ' + v.make + ' ' + v.model}</h1>
          <div style={sx('font-size:15px;color:var(--color-neutral-800)')}>{v.variant} · {v.plate} · {fmt.km(v.mileage)}</div>
        </div>
        <span style={{ ...badge.style, fontSize: '13px', padding: '6px 12px' }}>{badge.label}</span>
      </div>
      <div style={{ ...sx('display:grid;gap:4px;margin-bottom:28px'), gridTemplateColumns: wide ? 'repeat(7,minmax(0,1fr))' : 'minmax(0,1fr)' }}>
        {steps.map(st => (
          <div key={st.label} style={{ ...sx('display:flex;gap:8px;min-width:0'), flexDirection: wide ? 'column' : 'row', alignItems: wide ? 'flex-start' : 'center' }}>
            <div style={{ ...sx('width:28px;height:28px;flex:none;display:grid;place-items:center;font-size:13px;font-weight:800'), background: st.markBg, color: st.markFg, border: '2px solid ' + st.markBorder }}>{st.mark}</div>
            <div style={sx('min-width:0')}><div style={{ fontSize: 13, fontWeight: st.weight, color: st.fg }}>{st.label}</div><div style={sx('font-size:11px;color:var(--color-neutral-700)')}>{st.date}</div></div>
          </div>
        ))}
      </div>
      <div style={sx('border:2px solid var(--color-text);padding:18px 20px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:28px')}>
        <div>
          <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);font-weight:600')}>What happens next</div>
          <div style={sx('font-weight:800;font-size:20px;margin-top:2px')}>{next.title}</div>
          <div style={sx('font-size:14px;color:var(--color-neutral-800);margin-top:2px')}>{next.body}</div>
        </div>
        {na2 && t !== na2[1] && <button className="btn btn-primary" onClick={() => DA.go('customer', 'vehicle', { id: s.id, tab: na2[1] })} style={sx('min-height:44px;padding:10px 18px')}>{na2[0]} →</button>}
      </div>
      <div role="tablist" style={sx('display:flex;overflow-x:auto;border-bottom:2px solid var(--color-divider);margin-bottom:28px')}>
        {tabs.map(([k, label, count]) => (
          <button key={k} role="tab" aria-selected={t === k} onClick={() => DA.go('customer', 'vehicle', { id: s.id, tab: k })} style={{ ...sx('font:inherit;font-size:14px;min-height:46px;padding:0 16px;border:0;background:transparent;cursor:pointer;margin-bottom:-2px;display:flex;gap:6px;align-items:center'), borderBottom: '3px solid ' + (t === k ? 'var(--color-accent)' : 'transparent'), color: t === k ? 'var(--color-text)' : 'var(--color-neutral-700)', fontWeight: t === k ? 800 : 400 }}>{label}{countPill(count || 0)}</button>
        ))}
      </div>

      {t === 'overview' && (
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:40px')}>
          <section>
            <h3 style={sx('font-size:18px;margin:0 0 12px')}>Summary</h3>
            <div style={sx('border-top:2px solid var(--color-text)')}>{facts.map(([k, val]) => kvRow(k, val))}</div>
          </section>
          <section>
            <h3 style={sx('font-size:18px;margin:0 0 12px')}>Timeline</h3>
            <div style={sx('border-top:2px solid var(--color-text)')}>
              {tl.slice().reverse().slice(0, 8).map(e => (
                <div key={e.id} style={sx('display:grid;grid-template-columns:72px 14px 1fr;gap:10px;padding:11px 0;border-bottom:1px solid var(--color-divider);font-size:14px;align-items:baseline')}>
                  <span style={sx('color:var(--color-neutral-700);font-variant-numeric:tabular-nums')}>{e.date}</span>
                  <span style={{ width: 10, height: 10, background: e.dot }} />
                  <span>{e.text}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {t === 'details' && (
        <>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:32px')}>
            {detailGroups.map(g => (
              <section key={g.title}>
                <h3 style={sx('font-size:18px;margin:0 0 12px')}>{g.title}</h3>
                <div style={sx('border-top:2px solid var(--color-text)')}>{g.rows.map(kv => kvRow(kv.k, kv.v, '10px'))}</div>
              </section>
            ))}
          </div>
          <p style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:24px')}>Need to change something? Send your valuator a message and we’ll update it.</p>
        </>
      )}

      {t === 'photos' && (
        <>
          {reqs.length > 0 && <div style={sx('border-left:6px solid var(--color-accent);background:var(--color-accent-100);color:var(--color-accent-800);padding:12px 16px;margin-bottom:20px;font-size:14px')}>Your valuator asked for a better photo: <strong>{reqs.map(x => x.type).join(', ')}</strong>. Tap the photo to replace it.</div>}
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,180px),1fr));gap:14px')}>
            {REQUIRED_PHOTOS.concat(OPTIONAL_PHOTOS).map(type => {
              const p = DA.photosOf(s.id).find(x => x.type === type); const req = reqs.some(x => x.type === type);
              const required = REQUIRED_PHOTOS.includes(type);
              return (
                <div key={type} style={sx('display:flex;flex-direction:column;gap:6px')}>
                  <div onClick={() => onReplace(type)} style={{ ...sx('aspect-ratio:4/3;position:relative;cursor:pointer;display:grid;place-items:center;overflow:hidden'), background: p ? HATCH : 'var(--color-bg)', border: req ? '3px solid var(--color-accent)' : p ? '1px solid var(--color-divider)' : '1px dashed var(--color-neutral-500)' }}>
                    {p?.url ? <img src={p.url} alt={type} style={sx('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.08)')} />
                      : <span style={sx('font:600 11px ui-monospace,Menlo,monospace;letter-spacing:0.06em;text-transform:uppercase;background:var(--color-bg);padding:3px 6px;color:var(--color-neutral-700)')}>{p ? type : '+ Add'}</span>}
                  </div>
                  <div style={sx('display:flex;justify-content:space-between;font-size:13px;gap:8px')}><span style={sx('font-weight:600')}>{type}</span><span style={{ color: req || (!p && required) ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>{req ? 'Replacement requested' : p ? 'Uploaded ' + fmt.date(p.uploaded) : (required ? 'Missing' : 'Optional')}</span></div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {t === 'offer' && (!o ? (
        <div style={sx('border:2px dashed var(--color-neutral-400);padding:40px 28px;max-width:640px')}>
          <div style={sx('font-weight:800;font-size:22px;margin-bottom:6px')}>No offers yet.</div>
          <div style={sx('font-size:15px;color:var(--color-neutral-800)')}>We’re currently reviewing your vehicle. Offers usually arrive within 2 business hours.</div>
        </div>
      ) : (
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:32px;align-items:start')}>
          <div style={sx('background:var(--color-surface);border-top:8px solid var(--color-accent);padding:clamp(20px,3vw,32px);display:flex;flex-direction:column;gap:14px')}>
            <div style={sx('font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:600;color:var(--color-accent-700)')}>{isFinal ? 'Final offer' : 'Our offer'}</div>
            <div style={sx('font-weight:800;font-size:clamp(48px,7vw,76px);line-height:1;letter-spacing:-0.03em;font-variant-numeric:tabular-nums')}>{fmt.peso(o.amount)}</div>
            <div style={sx('font-size:15px')}>{validity}</div>
            {note && <div style={sx('font-size:14px;border-left:4px solid var(--color-text);padding:6px 12px;background:var(--color-bg)')}>{note}</div>}
            {pendingOffer && (
              <div style={sx('display:flex;flex-direction:column;gap:8px;margin-top:6px')}>
                <button className="btn btn-primary btn-block" onClick={acceptOffer} style={sx('min-height:52px;font-size:16px;padding:12px 18px;margin:0')}>Accept Offer</button>
                <div style={sx('display:grid;grid-template-columns:1fr 1fr;gap:8px')}>
                  <button className="btn btn-secondary" onClick={askQuestion} style={sx('min-height:48px;justify-content:flex-start')}>Ask a Question</button>
                  <button className="btn btn-secondary" onClick={declineOffer} style={sx('min-height:48px;justify-content:flex-start')}>Decline Offer</button>
                </div>
              </div>
            )}
            {statusText && <div style={sx('display:flex;gap:8px;align-items:center;font-weight:800;font-size:16px;border-top:2px solid var(--color-divider);padding-top:12px')}><span style={{ width: 12, height: 12, background: s.status === 'Customer Declined' || s.status === 'Expired' ? 'var(--color-neutral-500)' : 'var(--color-accent)' }} />{statusText}</div>}
          </div>
          <div style={sx('display:flex;flex-direction:column;gap:20px')}>
            {showSchedule && (
              <section style={sx('border:2px solid var(--color-text);padding:20px;display:flex;flex-direction:column;gap:16px')}>
                <div><div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);font-weight:600')}>Next step</div><div style={sx('font-weight:800;font-size:22px')}>Schedule Inspection</div><div style={sx('font-size:14px;color:var(--color-neutral-800)')}>About 45 minutes. Bring both keys and the OR/CR.</div></div>
                <div className="field"><label style={sx('font-weight:600')}>Date</label>
                  <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px')}>
                    {days.map(dt => { const iso = fmt.iso(dt); return <button key={iso} onClick={() => setSched({ ...sched, date: iso })} style={{ ...sx('font:inherit;min-height:56px;padding:6px 8px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:2px'), ...opt(sched.date === iso) }}><span style={sx('font-size:11px')}>{DOW[manila(dt).getUTCDay()]}</span><span style={sx('font-weight:800;font-size:15px')}>{fmt.date(dt)}</span></button>; })}
                  </div>
                </div>
                <div className="field"><label style={sx('font-weight:600')}>Time</label>
                  <div style={sx('display:flex;flex-wrap:wrap;gap:6px')}>{['9:00 AM', '10:00 AM', '1:00 PM', '3:00 PM'].map(tm => <button key={tm} onClick={() => setSched({ ...sched, time: tm })} style={{ ...sx('font:inherit;font-size:14px;min-height:44px;padding:8px 14px;cursor:pointer'), ...opt(sched.time === tm) }}>{tm}</button>)}</div>
                </div>
                <div className="field"><label style={sx('font-weight:600')}>Where</label>
                  <div style={sx('display:flex;flex-direction:column;gap:6px')}>{places.map(pl => <button key={pl} onClick={() => setSched({ ...sched, place: pl })} style={{ ...sx('font:inherit;font-size:14px;text-align:left;white-space:normal;min-height:48px;padding:10px 14px;cursor:pointer'), ...opt(sched.place === pl) }}>{pl}</button>)}</div>
                </div>
                <button className="btn btn-primary btn-block" onClick={confirmSchedule} disabled={!(sched.date && sched.time && sched.place)} style={sx('min-height:48px;font-size:15px;padding:12px 16px')}>Confirm inspection</button>
              </section>
            )}
            {showInspection && ins && (
              <section style={sx('border:2px solid var(--color-text);padding:20px;display:flex;flex-direction:column;gap:8px')}>
                <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);font-weight:600')}>Inspection</div>
                <div style={sx('font-weight:800;font-size:20px')}>{(ins.date ? fmt.dateLong(ts(ins.date)) : '') + ' · ' + ins.time}</div>
                <div style={sx('font-size:14px')}>{ins.location}</div>
                <div style={sx('font-size:14px;color:var(--color-neutral-800)')}>Inspector: {DA.staffName(ins.inspector)} · {ins.status}</div>
                {s.status === 'Inspection Scheduled' && <button className="btn btn-secondary" onClick={() => setRescheduling(true)} style={sx('align-self:flex-start;margin-top:6px')}>Reschedule</button>}
              </section>
            )}
            <section>
              <h3 style={sx('font-size:18px;margin:0 0 10px')}>Offer history</h3>
              <div style={sx('border-top:2px solid var(--color-text)')}>
                {offers.slice().reverse().map(x => (
                  <div key={x.id} style={sx('display:grid;grid-template-columns:1fr auto;gap:4px 16px;padding:12px 0;border-bottom:1px solid var(--color-divider);font-size:14px')}>
                    <span style={sx('font-weight:600')}>{x.byCustomer ? 'Your counter-offer' : x.type}</span><span style={{ ...sx('font-weight:800;font-variant-numeric:tabular-nums'), textDecoration: x.status === 'Superseded' ? 'line-through' : 'none' }}>{fmt.peso(x.amount)}</span>
                    <span style={sx('color:var(--color-neutral-700);font-size:13px')}>{fmt.dateY(x.ts)}</span><span style={sx('font-size:12px;color:var(--color-neutral-700);text-align:right')}>{x.status === 'Superseded' ? 'Replaced by a newer offer' : x.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      ))}

      {t === 'messages' && messages}

      {t === 'documents' && (
        <div style={sx('max-width:760px;border-top:2px solid var(--color-text)')}>
          {docDef.map(([name, desc, byUs]) => {
            const up = docsUp.find(d => d.name === name); const ready = byUs && sale;
            return (
              <div key={name} style={sx('display:grid;grid-template-columns:1fr auto;gap:6px 16px;padding:16px 0;border-bottom:1px solid var(--color-divider);align-items:center')}>
                <div><div style={sx('font-weight:800;font-size:15px')}>{name}</div><div style={sx('font-size:13px;color:var(--color-neutral-700)')}>{desc}</div></div>
                <div style={sx('display:flex;gap:8px;align-items:center')}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: up || ready ? 'var(--color-text)' : 'var(--color-neutral-700)' }}>{byUs ? (ready ? 'Ready for signing' : 'After sale agreed') : up ? 'Uploaded ' + fmt.date(up.ts) : 'Not uploaded'}</span>
                  {!byUs && <button className="btn btn-secondary" onClick={() => { DA.uploadDoc(s.id, name); DA.toast(name + ' uploaded'); }}>{up ? 'Replace' : 'Upload'}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {t === 'activity' && (
        <div style={sx('max-width:760px;border-top:2px solid var(--color-text)')}>
          {hist.slice().reverse().map(h => (
            <div key={h.id} style={sx('display:grid;grid-template-columns:140px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--color-divider);font-size:14px')}><span style={sx('color:var(--color-neutral-700)')}>{fmt.dateTime(h.ts)}</span><span>{CUST_TEXT[h.status] || h.status}</span></div>
          ))}
        </div>
      )}
    </>
  );
}
