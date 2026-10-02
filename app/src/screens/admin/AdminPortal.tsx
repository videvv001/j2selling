import { useEffect, useRef, useState } from 'react';
import { BRAND } from '../../config';
import { sx } from '../../lib/sx';
import { useWidth } from '../../lib/useWidth';
import { DA, fmt, initials, type SearchResult, type Status } from '../../store';
import { AdminCMS } from './AdminCMS';
import { AdminCustomers } from './AdminCustomers';
import { AdminDashboard } from './AdminDashboard';
import { AdminReports } from './AdminReports';
import { AdminSubmissions } from './AdminSubmissions';
import { AdminTeam } from './AdminTeam';
import { AdminWorkspace } from './AdminWorkspace';

const QUEUE_PAGES = ['submissions', 'valuations', 'offers', 'inspections', 'sales'];
const CANNED = ['We can review the valuation again based on the service history.', 'Thanks! Could you send a clearer photo of the odometer?', 'Your inspection is confirmed. Please have both keys and the OR/CR ready.', 'Payment has been initiated and should arrive within 1 business day.'];

/** Operations shell: sidebar navigation, global search, notifications and the shared inbox. */
export function AdminPortal() {
  const S = DA.S, r = S.route, pg = r.page;
  const w = useWidth();
  const narrow = w < 1024;
  const [side, setSide] = useState(false);
  const [q, setQ] = useState('');
  const [qFocus, setQFocus] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [threadSel, setThreadSel] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [inboxFilter, setInboxFilter] = useState('All');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName || '';
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag)) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') setBellOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const st = S.staff.find(x => x.id === S.session.adminId) || S.staff[1];
  const go = (p: string) => () => { setSide(false); DA.go('admin', p); };
  const cnt = (list: Status[]) => S.submissions.filter(s => list.includes(s.status)).length;
  const unreadAdmin = S.submissions.filter(s => S.messages.some(m => m.submissionId === s.id && !m.readByAdmin)).length;
  const active = pg === 'workspace' ? 'submissions' : pg === 'customer' ? 'customers' : pg === 'article-edit' ? 'articles' : pg;
  const item = (label: string, p: string, count?: number, hot?: boolean) => ({ label, p, count: count || 0, hot: !!hot, on: active === p });
  const att = DA.attention();
  const navGroups = [
    { title: 'Operations', items: [item('Dashboard', 'dashboard', att.filter(a => a.hot).length, true), item('Vehicle Submissions', 'submissions', cnt(['Submitted']), true), item('Valuations', 'valuations', cnt(['Under Review', 'Valuation In Progress', 'Valuated'])), item('Offers', 'offers', cnt(['Offer Sent', 'Negotiating', 'Final Offer'])), item('Inspections', 'inspections', cnt(['Offer Accepted', 'Inspection Scheduled'])), item('Sales / Purchases', 'sales', cnt(['Sale Agreed', 'Payment Processing']))] },
    { title: 'Relationships', items: [item('Customers', 'customers'), item('Messages', 'messages', unreadAdmin, true)] },
    { title: 'Content', items: [item('Articles', 'articles')] },
    { title: 'Insights', items: [item('Reports & Analytics', 'reports')] },
    { title: 'Administration', items: [item('Staff', 'staff'), item('Activity Logs', 'logs'), item('Settings', 'settings')] },
  ];
  const results = q.trim().length >= 2 ? DA.search(q) : [];
  const goResult = (x: SearchResult) => { setQ(''); setQFocus(false); if (x.type === 'Vehicle') DA.openCase(x.id); else DA.go('admin', 'customer', { id: x.id }); };
  const bell = S.notifications.filter(n => n.audience === 'admin').sort((a, b) => b.ts - a.ts).slice(0, 14);

  // Inbox
  const threads = S.submissions.map(s => ({ s, ms: DA.msgsOf(s.id) })).filter(x => x.ms.length).sort((a, b) => b.ms[b.ms.length - 1].ts - a.ms[a.ms.length - 1].ts);
  const visible = threads.filter(x => inboxFilter === 'All' || (inboxFilter === 'Unread' ? x.ms.some(m => !m.readByAdmin) : x.s.assignedTo === st.id));
  const convoId = threadSel || r.params.id || visible[0]?.s.id;
  const cs = convoId ? DA.sub(convoId) : null;
  const convoUnread = pg === 'messages' && !!cs && DA.msgsOf(cs.id).some(m => !m.readByAdmin);
  useEffect(() => {
    if (!convoUnread || !cs) return;
    const t = setTimeout(() => DA.markRead(cs.id, 'admin'), 500);
    return () => clearTimeout(t);
  }, [convoUnread, cs]);

  const logout = () => DA.confirm({ title: 'Log out of Operations?', body: 'Unsaved changes on this page will be lost.', confirmLabel: 'Log out', onConfirm: () => { DA.logout('admin'); DA.go('admin', 'dashboard'); } });
  const sendReply = () => { if (!cs) return; DA.sendMessage(cs.id, st.id, reply.trim()); DA.markRead(cs.id, 'admin'); setReply(''); DA.toast('Reply sent to ' + DA.cust(cs.customerId).first); };

  return (
    <div style={sx('display:flex;min-height:100vh;background:var(--color-bg);font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      {(!narrow || side) && (
        <aside style={{ ...sx('width:232px;flex:none;background:var(--color-text);color:var(--color-bg);display:flex;flex-direction:column;top:0;left:0;height:100vh;align-self:flex-start;z-index:50'), position: narrow ? 'fixed' : 'sticky', boxShadow: narrow ? 'var(--shadow-lg)' : 'none' }}>
          <div style={sx('padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--color-neutral-800)')}>
            <a onClick={go('dashboard')} style={sx('cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:800;font-size:18px;color:var(--color-bg);text-decoration:none')}><span style={sx('width:12px;height:12px;background:var(--color-accent)')} />{BRAND.name}<span style={sx('font-weight:400;font-size:12px;color:var(--color-neutral-400)')}>Ops</span></a>
            {narrow && <button onClick={() => setSide(false)} style={sx('font:inherit;background:transparent;border:0;color:var(--color-bg);cursor:pointer;font-size:18px')} aria-label="Close menu">×</button>}
          </div>
          <nav style={sx('flex:1;overflow:auto;padding:8px 0 16px')}>
            {navGroups.map(g => (
              <div key={g.title}>
                <div style={sx('padding:14px 18px 6px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-neutral-500)')}>{g.title}</div>
                {g.items.map(n => (
                  <button key={n.p} onClick={go(n.p)} className="hover-ink-bg" style={{ ...sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 18px 8px 14px;font-size:13.5px'), borderLeft: '4px solid ' + (n.on ? 'var(--color-accent)' : 'transparent'), background: n.on ? 'var(--color-neutral-900)' : 'transparent', color: n.on ? 'var(--color-bg)' : 'var(--color-neutral-300)', fontWeight: n.on ? 700 : 400 }}>
                    <span>{n.label}</span>
                    {n.count > 0 && <span style={{ ...sx('font-size:11px;padding:1px 6px;color:#fff;font-variant-numeric:tabular-nums'), background: n.hot ? 'var(--color-accent)' : 'var(--color-neutral-700)' }}>{n.count}</span>}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div style={sx('padding:14px 18px;border-top:1px solid var(--color-neutral-800);display:flex;gap:10px;align-items:center')}>
            <div style={sx('width:32px;height:32px;background:var(--color-accent);display:grid;place-items:center;font-weight:800;font-size:12px')}>{initials(st.name)}</div>
            <div style={sx('min-width:0;flex:1')}><div style={sx('font-weight:600;font-size:13px')}>{st.name}</div><div style={sx('font-size:11px;color:var(--color-neutral-400)')}>{st.role}</div></div>
            <button onClick={logout} style={sx('font:inherit;font-size:12px;background:transparent;border:0;color:var(--color-neutral-400);cursor:pointer;text-decoration:underline')}>Log out</button>
          </div>
        </aside>
      )}
      <div style={sx('flex:1;min-width:0;display:flex;flex-direction:column')}>
        <header style={sx('position:sticky;top:0;z-index:40;background:var(--color-bg);border-bottom:2px solid var(--color-divider);display:flex;align-items:center;gap:12px;padding:10px clamp(12px,2vw,24px)')}>
          {narrow && <button className="btn btn-secondary" onClick={() => setSide(true)} aria-label="Open menu">Menu</button>}
          <div style={sx('position:relative;flex:1;max-width:560px')}>
            <input ref={searchRef} className="input" value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { const ex = results.find(x => x.exact) || results[0]; if (ex) goResult(ex); else DA.toast('No match for “' + q + '”'); }
                if (e.key === 'Escape') { setQ(''); e.currentTarget.blur(); }
              }}
              onFocus={() => setQFocus(true)} onBlur={() => setTimeout(() => setQFocus(false), 150)}
              placeholder="Search reference, plate, customer, phone, make…  ( / )" style={sx('min-height:38px;padding-left:12px')} />
            {qFocus && q.trim().length >= 2 && (
              <div style={sx('position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--color-bg);border:2px solid var(--color-text);box-shadow:var(--shadow-lg);z-index:60;max-height:420px;overflow:auto')}>
                {results.map((x, i) => (
                  <button key={x.type + x.id} onMouseDown={() => goResult(x)} className="hover-surface-bg" style={{ ...sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:72px 1fr;gap:10px;padding:10px 12px;border-bottom:1px solid var(--color-divider)'), background: i === 0 ? 'var(--color-surface)' : 'transparent' }}>
                    <span style={sx('font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700);padding-top:2px')}>{x.type}</span>
                    <span><span style={sx('display:block;font-weight:700;font-size:13.5px')}>{x.title}</span><span style={sx('display:block;font-size:12px;color:var(--color-neutral-700)')}>{x.sub}</span></span>
                  </button>
                ))}
                {results.length === 0 && <div style={sx('padding:14px;font-size:13px;color:var(--color-neutral-700)')}>No matches for “{q}”.</div>}
              </div>
            )}
          </div>
          <div style={sx('margin-left:auto;display:flex;gap:8px;align-items:center;position:relative')}>
            <button className="btn btn-secondary" onClick={() => setBellOpen(b => !b)} aria-label="Notifications" style={sx('gap:8px')}>Notifications{bell.some(n => !n.read) && <span style={sx('background:var(--color-accent-700);color:#fff;font-size:11px;padding:1px 6px')}>{bell.filter(n => !n.read).length}</span>}</button>
            {bellOpen && (
              <div style={sx('position:absolute;top:calc(100% + 6px);right:0;width:min(400px,90vw);background:var(--color-bg);border:2px solid var(--color-text);box-shadow:var(--shadow-lg);z-index:60')}>
                <div style={sx('display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:2px solid var(--color-divider)')}><strong>Notifications</strong><button className="btn btn-ghost" onClick={() => DA.readNotifications('admin')} style={sx('font-size:12px')}>Mark all read</button></div>
                <div style={sx('max-height:420px;overflow:auto')}>
                  {bell.map(n => (
                    <button key={n.id} className="hover-surface-bg" onClick={() => {
                      n.read = true; setBellOpen(false);
                      if (n.submissionId) DA.openCase(n.submissionId, /message/i.test(n.text) ? 'messages' : /photo/i.test(n.text) ? 'photos' : undefined);
                      else DA.go('admin', 'dashboard');
                    }} style={sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;grid-template-columns:10px 1fr;gap:10px;padding:11px 14px;border-bottom:1px solid var(--color-divider)')}>
                      <span style={{ width: 8, height: 8, marginTop: 6, background: n.read ? 'var(--color-neutral-300)' : 'var(--color-accent)' }} />
                      <span><span style={{ display: 'block', fontSize: 13, fontWeight: n.read ? 400 : 700 }}>{n.text}</span><span style={sx('display:block;font-size:11px;color:var(--color-neutral-700);margin-top:2px')}>{fmt.ago(n.ts)}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>
        <main data-scroll-root="" style={sx('flex:1;min-width:0;padding:clamp(16px,2.4vw,32px)')}>
          {pg === 'dashboard' && <AdminDashboard />}
          {QUEUE_PAGES.includes(pg) && <AdminSubmissions view={pg} />}
          {pg === 'workspace' && <AdminWorkspace />}
          {(pg === 'customers' || pg === 'customer') && <AdminCustomers />}
          {(pg === 'articles' || pg === 'article-edit') && <AdminCMS />}
          {pg === 'reports' && <AdminReports />}
          {['staff', 'logs', 'settings'].includes(pg) && <AdminTeam view={pg} />}
          {pg === 'messages' && (
            <>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:16px')}>
                <h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Messages</h1>
                <div style={sx('display:flex;border:1px solid var(--color-divider)')}>
                  {['All', 'Unread', 'Assigned to me'].map(x => <button key={x} onClick={() => { setInboxFilter(x); setThreadSel(null); }} style={{ ...sx('font:inherit;font-size:13px;padding:7px 12px;border:0;cursor:pointer'), background: inboxFilter === x ? 'var(--color-text)' : 'transparent', color: inboxFilter === x ? 'var(--color-bg)' : 'var(--color-text)' }}>{x}</button>)}
                </div>
              </div>
              <div style={{ ...sx('display:grid;border:2px solid var(--color-text);min-height:560px'), gridTemplateColumns: w > 900 ? '340px minmax(0,1fr)' : 'minmax(0,1fr)' }}>
                <div style={sx('border-right:2px solid var(--color-divider);overflow:auto;max-height:680px')}>
                  {visible.map(({ s, ms }) => {
                    const last = ms[ms.length - 1]; const un = ms.filter(m => !m.readByAdmin).length;
                    return (
                      <button key={s.id} onClick={() => setThreadSel(s.id)} style={{ ...sx('all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;flex-direction:column;gap:3px;padding:12px 14px;border-bottom:1px solid var(--color-divider)'), background: s.id === convoId ? 'var(--color-surface)' : 'transparent', borderLeft: '4px solid ' + (un ? 'var(--color-accent)' : 'transparent') }}>
                        <div style={sx('display:flex;justify-content:space-between;gap:8px')}><strong style={sx('font-size:13.5px')}>{DA.cust(s.customerId).name}</strong><span style={sx('font-size:11px;color:var(--color-neutral-700)')}>{fmt.ago(last.ts)}</span></div>
                        <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>{s.ref} · {DA.vName(s)}</div>
                        <div style={sx('display:flex;justify-content:space-between;gap:8px;align-items:center')}><span style={sx('font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{last.text}</span>{un > 0 && <span style={sx('background:var(--color-accent-700);color:#fff;font-size:11px;padding:1px 6px')}>{un}</span>}</div>
                      </button>
                    );
                  })}
                  {visible.length === 0 && <div style={sx('padding:20px;font-size:13px;color:var(--color-neutral-700)')}>No conversations waiting. Nice.</div>}
                </div>
                {cs && (() => {
                  const c = DA.cust(cs.customerId), badge = DA.badge(cs.status);
                  return (
                    <div style={sx('display:flex;flex-direction:column;min-width:0')}>
                      <div style={sx('padding:12px 16px;border-bottom:2px solid var(--color-divider);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center')}>
                        <div><strong>{c.name + ' · ' + c.phone}</strong><div style={sx('font-size:12px;color:var(--color-neutral-700)')}>{cs.ref} · {DA.vName(cs)} · <span style={badge.style}>{badge.label}</span></div></div>
                        <button className="btn btn-secondary" onClick={() => DA.openCase(cs.id, 'messages')}>Open case →</button>
                      </div>
                      <div style={sx('flex:1;padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto;max-height:440px')}>
                        {DA.msgsOf(cs.id).map(m => {
                          const staff = S.staff.some(x => x.id === m.from);
                          return (
                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: staff ? 'flex-end' : 'flex-start', gap: 3 }}>
                              <div style={{ ...sx('max-width:80%;padding:9px 12px;font-size:13.5px;line-height:1.5'), background: staff ? 'var(--color-text)' : 'var(--color-surface)', color: staff ? 'var(--color-bg)' : 'var(--color-text)' }}>{m.text}{m.attachment && <div style={sx('font-size:11px;margin-top:6px;border-top:1px solid currentColor;padding-top:4px')}>📎 {m.attachment}</div>}</div>
                              <div style={sx('font-size:11px;color:var(--color-neutral-700)')}>{DA.staffName(m.from) + (staff ? '' : ' (customer)')} · {fmt.dateTime(m.ts)}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={sx('border-top:2px solid var(--color-divider);padding:10px;display:flex;flex-direction:column;gap:8px')}>
                        <div style={sx('display:flex;gap:6px;flex-wrap:wrap')}>{CANNED.map(t => <button key={t} onClick={() => setReply(t)} style={sx('font:inherit;font-size:12px;padding:4px 8px;border:1px solid var(--color-divider);background:var(--color-surface);cursor:pointer;white-space:normal;text-align:left')}>{t}</button>)}</div>
                        <textarea className="input" value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply to customer… (visible to customer)" style={sx('min-height:64px')} />
                        <div style={sx('display:flex;justify-content:flex-end')}><button className="btn btn-primary" onClick={sendReply} disabled={!reply.trim()}>Send reply</button></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
