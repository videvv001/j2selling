import { useState } from 'react';
import { sx } from '../../lib/sx';
import { ACTIVE, DA, fmt, initials, type Customer } from '../../store';

type SortKey = 'name' | 'email' | 'phone' | 'registered' | 'submitted' | 'purchased' | 'value' | 'last';
const COLS: [SortKey, string, 'left' | 'right'][] = [['name', 'Customer', 'left'], ['email', 'Email', 'left'], ['phone', 'Phone', 'left'], ['registered', 'Registered', 'left'], ['submitted', 'Cars submitted', 'right'], ['purchased', 'Cars purchased', 'right'], ['value', 'Total purchase value', 'right'], ['last', 'Last activity', 'left']];
const TABS: [string, string][] = [['overview', 'Overview'], ['vehicles', 'Vehicles'], ['messages', 'Messages'], ['notes', 'Notes'], ['activity', 'Activity']];

function aggregate(c: Customer) {
  const S = DA.S;
  const subs = S.submissions.filter(s => s.customerId === c.id);
  const bought = subs.filter(s => s.status === 'Purchased');
  const acts = subs.map(s => s.updated).concat(S.messages.filter(m => subs.some(s => s.id === m.submissionId)).map(m => m.ts));
  return { subs, bought, value: bought.reduce((a, s) => a + (DA.saleOf(s.id)?.price || 0), 0), last: acts.length ? Math.max(...acts) : c.registered };
}

export function AdminCustomers() {
  const S = DA.S, r = S.route;
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: number }>({ key: 'last', dir: -1 });
  const [tab, setTab] = useState('overview');
  const [note, setNote] = useState('');

  if (r.page === 'customer') {
    const c = DA.cust(r.params.id) || S.customers[0], a = aggregate(c);
    const threads = a.subs.filter(s => DA.msgsOf(s.id).length);
    const acts = S.activity.filter(x => x.user === c.id || a.subs.some(s => s.ref === x.record)).sort((x, y) => y.ts - x.ts);
    const openCount = a.subs.filter(s => ACTIVE(s.status)).length;
    const stats: [string, string | number, boolean?][] = [['Vehicles submitted', a.subs.length], ['Vehicles purchased', a.bought.length], ['Total purchase value', fmt.peso(a.value), true], ['Open cases', openCount], ['Customer since', fmt.dateY(c.registered)]];
    const contact: [string, string][] = [['Email', c.email], ['Mobile', c.phone], ['City', c.city || '—'], ['Preferred contact', c.contactPref || 'SMS'], ['Registered', fmt.dateLong(c.registered)], ['Acquired via', c.source], ['Payout account', 'BPI Savings ••' + c.phone.slice(-4)]];
    const actText = (x: typeof acts[number]) => x.action + ' · ' + x.record + (x.details ? ' · ' + x.details : '');
    return (
      <div style={sx('display:flex;flex-direction:column;gap:18px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
        <button className="btn btn-ghost" onClick={() => DA.go('admin', 'customers')} style={sx('align-self:flex-start')}>← Customers</button>
        <div style={sx('display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start')}>
          <div style={sx('display:flex;gap:16px;align-items:center')}>
            <span style={sx('width:56px;height:56px;background:var(--color-accent);color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800')}>{initials(c.name)}</span>
            <div><h1 style={sx('font-size:32px;margin:0;letter-spacing:-0.02em')}>{c.name}</h1><div style={sx('font-size:13px;color:var(--color-neutral-800);display:flex;gap:14px;flex-wrap:wrap;margin-top:4px')}><span>{c.email}</span><span>{c.phone}</span><span>{c.city || '—'}</span><span>Prefers {c.contactPref || 'SMS'}</span></div></div>
          </div>
          <div style={sx('display:flex;gap:8px')}>
            <button className="btn btn-secondary" onClick={() => { const s = a.subs[0]; if (s) DA.openCase(s.id, 'messages'); else DA.toast('No vehicle to message about yet'); }}>Message</button>
            <button className="btn btn-secondary" onClick={() => DA.confirm({ title: 'Log a call with ' + c.first, body: 'Saved to this customer’s internal notes.', input: 'textarea', inputLabel: 'Call summary', confirmLabel: 'Save call', onConfirm: v => { DA.addCustomerNote(c.id, 'Call: ' + (v || 'No summary')); DA.toast('Call logged'); } })}>Log call</button>
          </div>
        </div>
        <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));border-top:2px solid var(--color-text)')}>
          {stats.map(([k, v, hot]) => <div key={k} style={sx('padding:12px 16px 14px 0;border-bottom:1px solid var(--color-divider)')}><div style={sx('font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700)')}>{k}</div><div style={{ ...sx('font-weight:800;font-size:26px'), color: hot ? 'var(--color-accent)' : 'var(--color-text)' }}>{v}</div></div>)}
        </div>
        <div role="tablist" style={sx('display:flex;overflow-x:auto;border-bottom:2px solid var(--color-divider)')}>
          {TABS.map(([k, label]) => <button key={k} onClick={() => setTab(k)} style={{ ...sx('font:inherit;font-size:14px;padding:10px 14px;border:0;background:transparent;cursor:pointer;margin-bottom:-2px'), borderBottom: '3px solid ' + (tab === k ? 'var(--color-accent)' : 'transparent'), color: tab === k ? 'var(--color-text)' : 'var(--color-neutral-700)', fontWeight: tab === k ? 800 : 400 }}>{label}</button>)}
        </div>
        {tab === 'overview' && (
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:28px')}>
            <section><h3 style={sx('font-size:17px;margin:0 0 8px')}>Contact information</h3><div style={sx('border-top:2px solid var(--color-text)')}>{contact.map(([k, v]) => <div key={k} style={sx('display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider)')}><span style={sx('color:var(--color-neutral-700)')}>{k}</span><strong>{v}</strong></div>)}</div></section>
            <section><h3 style={sx('font-size:17px;margin:0 0 8px')}>Latest activity</h3><div style={sx('border-top:2px solid var(--color-text)')}>{acts.slice(0, 6).map(x => <div key={x.id} style={sx('display:grid;grid-template-columns:90px 1fr;gap:10px;padding:9px 0;border-bottom:1px solid var(--color-divider);font-size:13px')}><span style={sx('color:var(--color-neutral-700)')}>{fmt.ago(x.ts)}</span><span>{actText(x)}</span></div>)}</div></section>
          </div>
        )}
        {tab === 'vehicles' && (
          <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}><table className="table" style={sx('font-size:13px;min-width:760px')}>
            <thead><tr><th>Reference</th><th>Vehicle</th><th>Submitted</th><th>Offer / price</th><th>Staff</th><th>Status</th></tr></thead>
            <tbody>{a.subs.slice().sort((x, y) => y.submitted - x.submitted).map(s => {
              const v = DA.veh(s), sl = DA.saleOf(s.id), o = DA.currentOffer(s.id), b = DA.badge(s.status);
              return <tr key={s.id} onClick={() => DA.openCase(s.id)} style={sx('cursor:pointer')}><td style={sx('font-weight:700')}>{s.ref}</td><td>{DA.vName(s)}<div style={sx('font-size:11.5px;color:var(--color-neutral-700)')}>{v.plate} · {fmt.km(v.mileage)}</div></td><td>{fmt.dateY(s.submitted)}</td><td style={sx('font-weight:700')}>{sl ? fmt.peso(sl.price) : o ? fmt.peso(o.amount) : '—'}</td><td>{DA.staffName(s.assignedTo)}</td><td><span style={b.style}>{b.label}</span></td></tr>;
            })}</tbody>
          </table></div>
        )}
        {tab === 'messages' && (
          <div style={sx('display:flex;flex-direction:column;gap:16px;max-width:860px')}>
            {threads.map(s => (
              <section key={s.id} style={sx('border:2px solid var(--color-text)')}>
                <div style={sx('padding:10px 14px;border-bottom:2px solid var(--color-divider);display:flex;justify-content:space-between')}><strong>{s.ref + ' · ' + DA.vName(s)}</strong><a onClick={() => DA.openCase(s.id, 'messages')} style={sx('cursor:pointer;font-size:13px')}>Open case →</a></div>
                <div style={sx('padding:12px 14px;display:flex;flex-direction:column;gap:8px')}>{DA.msgsOf(s.id).slice(-4).map(m => <div key={m.id} style={sx('font-size:13px')}><strong>{DA.staffName(m.from)}</strong> <span style={sx('color:var(--color-neutral-700)')}>· {fmt.dateTime(m.ts)}</span><div>{m.text}</div></div>)}</div>
              </section>
            ))}
            {threads.length === 0 && <div style={sx('font-size:14px;color:var(--color-neutral-700)')}>No messages with this customer.</div>}
          </div>
        )}
        {tab === 'notes' && (
          <div style={sx('max-width:760px;display:flex;flex-direction:column;gap:12px;background:var(--color-surface);padding:16px 18px')}>
            <div style={sx('display:flex;justify-content:space-between;align-items:baseline')}><h3 style={sx('font-size:17px;margin:0')}>Internal notes</h3><span style={sx('font-size:11px;font-weight:600;background:var(--color-text);color:var(--color-bg);padding:2px 6px')}>Staff only</span></div>
            <textarea className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Prefers calls after 6 PM." style={sx('background:var(--color-bg)')} />
            <button className="btn btn-secondary" onClick={() => { DA.addCustomerNote(c.id, note.trim()); setNote(''); DA.toast('Note added'); }} disabled={!note.trim()} style={sx('align-self:flex-start')}>Add note</button>
            {(c.notes || []).slice().sort((x, y) => y.ts - x.ts).map(n => <div key={n.id} style={sx('border-top:1px solid var(--color-divider);padding-top:8px;font-size:13.5px')}><div>{n.text}</div><div style={sx('font-size:11px;color:var(--color-neutral-700)')}>{DA.staffName(n.by)} · {fmt.dateTime(n.ts)}</div></div>)}
          </div>
        )}
        {tab === 'activity' && (
          <div style={sx('max-width:900px;border-top:2px solid var(--color-text)')}>{acts.map(x => <div key={x.id} style={sx('display:grid;grid-template-columns:130px 160px 1fr;gap:12px;padding:9px 0;border-bottom:1px solid var(--color-divider);font-size:13px')}><span style={sx('color:var(--color-neutral-700)')}>{fmt.dateTime(x.ts)}</span><strong>{DA.staffName(x.user)}</strong><span>{actText(x)}</span></div>)}</div>
        )}
      </div>
    );
  }

  const ql = q.trim().toLowerCase();
  const data = S.customers.map(c => { const a = aggregate(c); return { c, name: c.name, email: c.email, phone: c.phone, registered: c.registered, submitted: a.subs.length, purchased: a.bought.length, value: a.value, last: a.last }; })
    .filter(x => !ql || (x.name + ' ' + x.email + ' ' + x.phone).toLowerCase().includes(ql))
    .sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : a[sort.key] < b[sort.key] ? -1 : 0) * sort.dir);
  const withOpen = S.customers.filter(c => S.submissions.some(s => s.customerId === c.id && ACTIVE(s.status))).length;

  return (
    <div style={sx('display:flex;flex-direction:column;gap:18px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
        <div><h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Customers</h1><div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>{S.customers.length + ' customers · ' + withOpen + ' with open cases'}</div></div>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email, phone" style={sx('max-width:320px;min-height:38px')} />
      </div>
      <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}>
        <table className="table" style={sx('font-size:13px;min-width:980px')}>
          <thead><tr>{COLS.map(([key, label, align]) => <th key={key} onClick={() => setSort({ key, dir: sort.key === key ? -sort.dir : -1 })} style={{ cursor: 'pointer', whiteSpace: 'nowrap', textAlign: align }}>{label} {sort.key === key ? (sort.dir > 0 ? '↑' : '↓') : ''}</th>)}</tr></thead>
          <tbody>
            {data.map(x => (
              <tr key={x.c.id} onClick={() => { setTab('overview'); DA.go('admin', 'customer', { id: x.c.id }); }} style={sx('cursor:pointer')}>
                <td><div style={sx('display:flex;gap:10px;align-items:center')}><span style={sx('width:30px;height:30px;flex:none;background:var(--color-text);color:var(--color-bg);display:grid;place-items:center;font-size:11px;font-weight:800')}>{initials(x.name)}</span><span style={sx('font-weight:700')}>{x.name}</span></div></td>
                <td>{x.email}</td><td style={sx('white-space:nowrap')}>{x.phone}</td><td style={sx('white-space:nowrap')}>{fmt.dateY(x.registered)}</td>
                <td style={sx('text-align:right')}>{x.submitted}</td><td style={sx('text-align:right')}>{x.purchased}</td><td style={sx('text-align:right;font-weight:800;white-space:nowrap')}>{x.value ? fmt.peso(x.value) : '—'}</td><td style={sx('white-space:nowrap')}>{fmt.ago(x.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
