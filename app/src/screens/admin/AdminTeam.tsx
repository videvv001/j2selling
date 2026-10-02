import { useState } from 'react';
import { BRAND } from '../../config';
import { sx } from '../../lib/sx';
import { ACTIVE, DA, PERMISSIONS, fmt, initials, type Settings } from '../../store';

const DESC: Record<string, string> = { 'View Vehicles': 'Open submissions and case workspaces', 'Edit Vehicles': 'Change vehicle, condition and status', 'Create Valuation': 'Draft valuations', 'Approve Valuation': 'Approve valuations above draft', 'Send Offer': 'Send offers to customers', 'View Internal Financial Data': 'Market value, max price, margins', 'Manage Inspections': 'Schedule and complete inspections', 'Manage Customers': 'Edit customers, add notes', 'Manage Articles': 'Create, publish and archive articles', 'View Reports': 'Reports & analytics', 'Manage Staff': 'Invite staff, change roles & permissions', 'Manage Settings': 'Company-wide settings' };
const EMAIL_RE = new RegExp('^\\S+@' + BRAND.domain.replace(/\./g, '\\.') + '$', 'i');
const PER_PAGE = 20;

type LogFilter = { q: string; user: string; action: string; from: string; to: string };
type SettingsForm = Omit<Settings, 'offerValidity' | 'attentionHours'> & { offerValidity: string | number; attentionHours: string | number };

/** Staff & permissions, the activity log and company settings. */
export function AdminTeam({ view = 'staff' }: { view?: string }) {
  const S = DA.S;
  const [invite, setInvite] = useState(false);
  const [inv, setInv] = useState({ name: '', email: '', role: 'Valuator' });
  const [invErr, setInvErr] = useState('');
  const [lf, setLf] = useState<LogFilter>({ q: '', user: '', action: '', from: '', to: '' });
  const [lpState, setLp] = useState(0);
  const [settings, setSettings] = useState<SettingsForm | null>(null);

  const me = S.staff.find(x => x.id === S.session.adminId) || S.staff[1];
  const canManage = (S.roles[me.role] || []).includes('Manage Staff');
  const roleNames = Object.keys(S.roles);

  /* logs */
  const logsAll = S.activity.slice().sort((a, b) => b.ts - a.ts).filter(a => (!lf.q || (a.record + ' ' + a.details).toLowerCase().includes(lf.q.toLowerCase())) && (!lf.user || a.user === lf.user) && (!lf.action || a.action === lf.action) && (!lf.from || a.ts >= Date.parse(lf.from)) && (!lf.to || a.ts <= Date.parse(lf.to) + 86400e3));
  const pages = Math.max(1, Math.ceil(logsAll.length / PER_PAGE)), lp = Math.min(lpState, pages - 1);
  const lset = (k: keyof LogFilter) => (e: { target: { value: string } }) => { const v = e.target.value; setLf(s => ({ ...s, [k]: v })); setLp(0); };
  const users = Array.from(new Set(S.activity.map(a => a.user).filter((x): x is string => !!x))).map(id => ({ id, name: DA.staffName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  const exportLogs = () => {
    const rows = [['Timestamp', 'User', 'Action', 'Record', 'Details']].concat(logsAll.map(a => [new Date(a.ts).toISOString(), DA.staffName(a.user), a.action, a.record, a.details]));
    const blob = new Blob([rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')], { type: 'text/csv' });
    const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = 'activity-log.csv'; el.click();
    DA.toast('Exported ' + logsAll.length + ' log entries');
  };

  /* settings */
  const st: SettingsForm = settings || { notifyNew: true, notifyMsg: true, notifyExpiry: true, dailyDigest: false, ...S.settings };
  const setS = (k: keyof SettingsForm) => (e: { target: { value: string } }) => { const v = e.target.value; setSettings(s => ({ ...(s || st), [k]: v })); };
  const tog = (k: 'notifyNew' | 'notifyMsg' | 'notifyExpiry' | 'dailyDigest') => () => setSettings(s => { const b = s || st; return { ...b, [k]: !b[k] }; });
  const saveSettings = () => { DA.saveSettings({ ...st, offerValidity: +st.offerValidity || 8, attentionHours: +st.attentionHours || 2 }); setSettings(null); DA.toast('Settings saved'); };

  const sendInvite = () => {
    if (!inv.name.trim()) { setInvErr('Enter a name.'); return; }
    if (!EMAIL_RE.test(inv.email)) { setInvErr('Use a @' + BRAND.domain + ' email address.'); return; }
    DA.addStaff(inv.name.trim(), inv.role, inv.email); setInvite(false); DA.toast('Invite sent to ' + inv.email);
  };
  const invSet = (k: keyof typeof inv) => (e: { target: { value: string } }) => { const v = e.target.value; setInv(s => ({ ...s, [k]: v })); setInvErr(''); };

  return (
    <div style={sx('display:flex;flex-direction:column;gap:18px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      {view === 'staff' && (
        <>
          <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
            <div><h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Staff &amp; Permissions</h1><div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>{S.staff.filter(x => x.active).length + ' active · ' + roleNames.length + ' roles'}</div></div>
            <button className="btn btn-primary" onClick={() => { setInvite(true); setInv({ name: '', email: '', role: 'Valuator' }); setInvErr(''); }} disabled={!canManage}>Invite staff</button>
          </div>
          {!canManage && <div style={sx('border-left:6px solid var(--color-text);background:var(--color-surface);padding:10px 14px;font-size:13.5px')}>You can view staff but need “Manage Staff” to make changes.</div>}
          <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}><table className="table" style={sx('font-size:13px;min-width:820px')}>
            <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Open cases</th><th>Last active</th><th>Status</th><th style={sx('text-align:right')}>Actions</th></tr></thead>
            <tbody>{S.staff.map(x => (
              <tr key={x.id} style={{ opacity: x.active ? 1 : 0.55 }}>
                <td><div style={sx('display:flex;gap:10px;align-items:center')}><span style={sx('width:28px;height:28px;background:var(--color-text);color:var(--color-bg);display:grid;place-items:center;font-size:11px;font-weight:800')}>{initials(x.name)}</span><strong>{x.name}</strong></div></td>
                <td><select value={x.role} onChange={e => { DA.setStaffRole(x.id, e.target.value); DA.toast(x.name + ' is now ' + e.target.value); }} disabled={!canManage} style={sx('font:inherit;font-size:13px;border:0;border-bottom:1px solid var(--color-divider);background:transparent')}>{roleNames.map(r => <option key={r} value={r}>{r}</option>)}</select></td>
                <td>{x.email}</td><td>{S.submissions.filter(s => s.assignedTo === x.id && ACTIVE(s.status)).length || '—'}</td><td>{x.id === S.session.adminId ? 'Now' : fmt.ago(x.lastActive)}</td><td style={sx('font-weight:700')}>{x.active ? 'Active' : 'Deactivated'}</td>
                <td style={sx('text-align:right')}><button className="btn btn-ghost" disabled={!canManage} style={sx('font-size:12px')} onClick={() => {
                  if (x.id === me.id) { DA.toast('You can’t deactivate your own account'); return; }
                  DA.confirm({ title: (x.active ? 'Deactivate ' : 'Reactivate ') + x.name + '?', body: x.active ? 'They will be signed out and lose access. Their cases stay assigned until you reassign them.' : 'They will regain access with their current role.', confirmLabel: x.active ? 'Deactivate' : 'Reactivate', onConfirm: () => { DA.toggleStaff(x.id); DA.toast(x.name + (x.active ? ' reactivated' : ' deactivated')); } });
                }}>{x.active ? 'Deactivate' : 'Reactivate'}</button></td>
              </tr>
            ))}</tbody>
          </table></div>
          <section style={sx('display:flex;flex-direction:column;gap:8px')}>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid var(--color-text);padding-top:12px;gap:12px;flex-wrap:wrap')}><h3 style={sx('font-size:18px;margin:0')}>Role permissions</h3><span style={sx('font-size:12px;color:var(--color-neutral-700)')}>Changes apply immediately and are written to the activity log. Super Admin always has full access.</span></div>
            <div style={sx('overflow-x:auto')}><table className="table" style={sx('font-size:13px;min-width:820px')}>
              <thead><tr><th>Permission</th>{roleNames.map(r => <th key={r} style={sx('text-align:center')}>{r}</th>)}</tr></thead>
              <tbody>{PERMISSIONS.map(p => (
                <tr key={p}>
                  <td style={sx('font-weight:600')}>{p}<div style={sx('font-size:11.5px;font-weight:400;color:var(--color-neutral-700)')}>{DESC[p] || ''}</div></td>
                  {roleNames.map(r => {
                    const on = S.roles[r].includes(p), locked = r === 'Super Admin' || !canManage;
                    return (
                      <td key={r} style={sx('text-align:center')}>
                        <button onClick={() => { DA.togglePerm(r, p); DA.toast((on ? 'Removed ' : 'Granted ') + '“' + p + '” ' + (on ? 'from ' : 'to ') + r); }} disabled={locked} aria-pressed={on} aria-label={r + ': ' + p}
                          style={{ ...sx('width:26px;height:26px;cursor:pointer;color:var(--color-bg);font-size:13px;font-weight:800'), border: '2px solid ' + (on ? 'var(--color-text)' : 'var(--color-neutral-400)'), background: on ? (r === 'Super Admin' ? 'var(--color-neutral-600)' : 'var(--color-text)') : 'transparent', opacity: locked && !on ? 0.5 : 1 }}>{on ? '✓' : ''}</button>
                      </td>
                    );
                  })}
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        </>
      )}

      {view === 'logs' && (
        <>
          <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
            <div><h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Activity Logs</h1><div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>Audit trail of every important action · {logsAll.length} entries</div></div>
            <button className="btn btn-secondary" onClick={exportLogs}>Export CSV</button>
          </div>
          <div style={sx('display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;background:var(--color-surface);padding:12px')}>
            <div className="field" style={sx('min-width:220px;flex:1')}><label>Search record or details</label><input className="input" value={lf.q} onChange={lset('q')} placeholder="CAR-2026-00124" /></div>
            <div className="field"><label>User</label><select className="input" value={lf.user} onChange={lset('user')}><option value="">Anyone</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div className="field"><label>Action</label><select className="input" value={lf.action} onChange={lset('action')}><option value="">Any action</option>{Array.from(new Set(S.activity.map(a => a.action))).sort().map(a => <option key={a} value={a}>{a}</option>)}</select></div>
            <div className="field"><label>From</label><input className="input" type="date" value={lf.from} onChange={lset('from')} /></div>
            <div className="field"><label>To</label><input className="input" type="date" value={lf.to} onChange={lset('to')} /></div>
          </div>
          <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}><table className="table" style={sx('font-size:13px;min-width:860px')}>
            <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
            <tbody>{logsAll.slice(lp * PER_PAGE, lp * PER_PAGE + PER_PAGE).map(a => {
              const s = S.submissions.find(x => x.ref === a.record);
              return <tr key={a.id} onClick={() => s && DA.openCase(s.id, 'activity')} style={{ cursor: s ? 'pointer' : 'default' }}><td style={sx('white-space:nowrap;font-variant-numeric:tabular-nums')}>{fmt.dateY(a.ts) + ' ' + fmt.time(a.ts)}</td><td style={sx('white-space:nowrap;font-weight:600')}>{DA.staffName(a.user)}</td><td style={sx('white-space:nowrap')}>{a.action}</td><td style={sx('white-space:nowrap;font-weight:700')}>{a.record}</td><td style={sx('color:var(--color-neutral-800)')}>{a.details}</td></tr>;
            })}</tbody>
          </table></div>
          <div style={sx('display:flex;justify-content:space-between;align-items:center;font-size:13px')}><span style={sx('color:var(--color-neutral-700)')}>Page {lp + 1} of {pages}</span><div style={sx('display:flex;gap:4px')}><button className="btn btn-secondary" onClick={() => setLp(Math.max(0, lp - 1))} disabled={lp === 0}>← Newer</button><button className="btn btn-secondary" onClick={() => setLp(Math.min(pages - 1, lp + 1))} disabled={lp >= pages - 1}>Older →</button></div></div>
        </>
      )}

      {view === 'settings' && (
        <>
          <h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Settings</h1>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:28px;max-width:1100px')}>
            <section style={sx('display:flex;flex-direction:column;gap:12px')}>
              <h3 style={sx('font-size:17px;margin:0;border-top:2px solid var(--color-text);padding-top:12px')}>Company</h3>
              {([['Company name', 'company'], ['Support email', 'email'], ['Support phone', 'phone'], ['Payout bank', 'bank']] as [string, keyof SettingsForm][]).map(([label, k]) => (
                <div key={k} className="field"><label style={sx('font-weight:600')}>{label}</label><input className="input" value={String(st[k] ?? '')} onChange={setS(k)} /></div>
              ))}
            </section>
            <section style={sx('display:flex;flex-direction:column;gap:12px')}>
              <h3 style={sx('font-size:17px;margin:0;border-top:2px solid var(--color-text);padding-top:12px')}>Workflow</h3>
              {([['Offer validity (days)', 'offerValidity', 'Default expiry for new offers'], ['Needs-attention threshold (hours)', 'attentionHours', 'Flag new submissions waiting longer than this']] as [string, keyof SettingsForm, string][]).map(([label, k, help]) => (
                <div key={k} className="field"><label style={sx('font-weight:600')}>{label}</label><input className="input" value={String(st[k] ?? '')} onChange={setS(k)} /><div style={sx('font-size:11.5px;color:var(--color-neutral-700);margin-top:4px')}>{help}</div></div>
              ))}
              {([['Email managers on new submissions', 'notifyNew'], ['Notify assignee on customer messages', 'notifyMsg'], ['Alert 24h before offers expire', 'notifyExpiry'], ['Daily digest at 8 AM', 'dailyDigest']] as [string, 'notifyNew' | 'notifyMsg' | 'notifyExpiry' | 'dailyDigest'][]).map(([label, k]) => (
                <label key={k} style={sx('display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--color-divider);cursor:pointer')}><span>{label}</span><input type="checkbox" checked={!!st[k]} onChange={tog(k)} style={sx('width:18px;height:18px;accent-color:var(--color-accent)')} /></label>
              ))}
            </section>
          </div>
          <div style={sx('display:flex;gap:8px;align-items:center')}><button className="btn btn-primary" onClick={saveSettings} disabled={!settings}>Save settings</button>{settings && <span style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600')}>Unsaved changes</span>}</div>
        </>
      )}

      {invite && (
        <div className="dialog-backdrop" style={sx('z-index:96')} onClick={() => setInvite(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={sx('border-top:6px solid var(--color-accent)')}>
            <div className="dialog-title">Invite staff member</div>
            <div className="field"><label>Full name</label><input className="input" value={inv.name} onChange={invSet('name')} /></div>
            <div className="field"><label>Work email</label><input className="input" value={inv.email} onChange={invSet('email')} placeholder={'name@' + BRAND.domain} /></div>
            <div className="field"><label>Role</label><select className="input" value={inv.role} onChange={invSet('role')}>{roleNames.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
            {invErr && <div style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600')}>{invErr}</div>}
            <div className="dialog-actions"><button className="btn btn-secondary" onClick={() => setInvite(false)}>Cancel</button><button className="btn btn-primary" onClick={sendInvite}>Send invite</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
