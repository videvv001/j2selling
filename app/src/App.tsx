import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_MODE } from './config';
import { sx } from './lib/sx';
import { pathToRoute, routeToPath } from './routes';
import { DA, registerNavigator, syncRoute, useStore } from './store';
import { Auth } from './screens/public/Auth';
import { Marketing } from './screens/public/Marketing';
import { SellWizard } from './screens/public/SellWizard';

// The portals are only needed after sign-in, so they load on demand.
const AdminPortal = lazy(() => import('./screens/admin/AdminPortal').then(m => ({ default: m.AdminPortal })));
const CustomerPortal = lazy(() => import('./screens/customer/CustomerPortal').then(m => ({ default: m.CustomerPortal })));

const AUTH_PAGES = ['signin', 'register', 'forgot', 'reset', 'admin-login'];
const GUIDE_STEPS = [
  { area: 'Public', text: 'Home → “Get My Car Valued”. Use “Fill with demo car” to load the 2022 Toyota Vios.' },
  { area: 'Wizard', text: 'Step through Vehicle, Condition, Ownership, Photos (“Simulate all uploads”), Contact, Review. Submit.' },
  { area: 'Customer', text: '“Track My Valuation” → dashboard shows the car at Under Review.' },
  { area: 'Admin', text: 'Switch to Admin. The new case appears in Needs Attention and Vehicle Submissions. Search “CAR-2026-00124”.' },
  { area: 'Admin', text: 'Open the case → Start review → Photos (flag / request) → Valuation → Approve → Send Offer.' },
  { area: 'Customer', text: 'Open the vehicle → Offer tab → Ask a Question or Accept Offer → Schedule Inspection.' },
  { area: 'Admin', text: 'Inspection tab → Start → checklist → Complete → Issue final offer.' },
  { area: 'Customer', text: 'Accept the final offer → Sale Agreed.' },
  { area: 'Admin', text: 'Sale tab → advance to Payment → Paid → Vehicle Received → Completed.' },
  { area: 'Admin', text: 'Dashboard and Reports now include the ₱570,000 purchase.' },
];
type Preset = 'Submitted' | 'Offer Sent' | 'Offer Accepted' | 'Inspection Completed';

export function App() {
  useStore();
  const location = useLocation();
  const navigate = useNavigate();
  // The URL is the source of truth for the route; mirror it into the store before any screen renders.
  syncRoute(pathToRoute(location.pathname, location.search));
  useEffect(() => {
    registerNavigator(r => {
      const path = routeToPath(r);
      if (path !== window.location.pathname + window.location.search) navigate(path);
    });
  }, [navigate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && DA.dialog) DA.closeDialog(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const S = DA.S, r = S.route, a = r.area, p = r.page;
  const wizard = a === 'public' && (p === 'sell' || p === 'sell-success');
  const needCust = a === 'customer' && !S.session.customerId;
  const needAdmin = a === 'admin' && !S.session.adminId;
  const isAuth = (a === 'public' && AUTH_PAGES.includes(p)) || needCust || needAdmin;
  const dlg = DA.dialog;

  return (
    <div style={sx('min-height:100vh;display:flex;flex-direction:column;font-family:var(--font-body)')}>
      {DEMO_MODE && <DemoBar />}
      <div style={sx('flex:1;display:flex;flex-direction:column;min-height:0')}>
        {a === 'public' && !wizard && !isAuth && <Marketing />}
        {wizard && <SellWizard />}
        {isAuth && <Auth key={a + ':' + p} />}
        <Suspense fallback={null}>
          {a === 'customer' && !needCust && <CustomerPortal />}
          {a === 'admin' && !needAdmin && <AdminPortal />}
        </Suspense>
      </div>
      <div style={sx('position:fixed;right:16px;bottom:16px;z-index:90;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none')} aria-live="polite">
        {DA.toasts.map(t => (
          <div key={t.id} style={sx('pointer-events:auto;min-width:260px;max-width:380px;display:flex;gap:10px;align-items:flex-start;background:var(--color-text);color:var(--color-bg);padding:12px 14px;font-size:13px;box-shadow:var(--shadow-lg);animation:da-in .2s ease-out;border-left:6px solid var(--color-accent)')}>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {dlg && (
        <div className="dialog-backdrop" style={sx('z-index:100')} onClick={() => DA.closeDialog()}>
          <div className="dialog" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={sx('width:min(480px,100%);border-top:6px solid var(--color-accent)')}>
            <div className="dialog-title">{dlg.title}</div>
            <div className="dialog-body" style={sx('white-space:pre-line')}>{dlg.body}</div>
            {dlg.input === 'textarea' && (
              <div className="field">
                <label>{dlg.inputLabel}</label>
                <textarea className="input" value={dlg.value} onChange={e => DA.setDialogValue(e.target.value)} placeholder={dlg.placeholder} />
              </div>
            )}
            {dlg.input === 'money' && (
              <div className="field">
                <label>{dlg.inputLabel}</label>
                <input className="input" inputMode="numeric" value={dlg.value} onChange={e => DA.setDialogValue(e.target.value)} style={sx('font-size:20px;font-weight:800')} />
              </div>
            )}
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => DA.closeDialog()}>{dlg.cancelLabel || 'Cancel'}</button>
              <button className="btn btn-primary" onClick={() => { const d = DA.dialog; DA.closeDialog(); d?.onConfirm?.(d.value); }}>{dlg.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Prototype controls: area switcher, quick logins, demo presets, demo script and reset. Shown only in demo mode. */
function DemoBar() {
  const [guide, setGuide] = useState(false);
  const S = DA.S, a = S.route.area;
  const c = S.session.customerId ? DA.cust(S.session.customerId) : null;
  const st = S.session.adminId ? S.staff.find(x => x.id === S.session.adminId) : null;
  const sessionLabel = [c ? 'Customer: ' + c.name : null, st ? 'Admin: ' + st.name : null].filter(Boolean).join(' · ') || 'Signed out';
  const tabs: [string, 'public' | 'customer' | 'admin', string][] = [['Public website', 'public', 'home'], ['Customer portal', 'customer', 'dashboard'], ['Admin portal', 'admin', 'dashboard']];
  const barBtn = sx('font:inherit;font-size:12px;padding:5px 10px;border:1px solid var(--color-neutral-700);background:transparent;color:var(--color-bg);cursor:pointer');
  const onPreset = (v: string) => {
    if (!v) return;
    DA.preset(v as Preset);
    const live = DA.S.submissions.filter(s => s.live).pop();
    if (v === 'Submitted') DA.go('admin', 'dashboard'); else DA.go('customer', 'vehicle', { id: live?.id });
  };
  const reset = () => DA.confirm({ title: 'Reset demo data?', body: 'All submissions, offers and messages created during this demo will be cleared and the sample data restored.', confirmLabel: 'Reset demo', onConfirm: () => { DA.reset(); DA.go('public', 'home'); } });

  return (
    <>
      <div style={sx('position:relative;z-index:60;background:var(--color-text);color:var(--color-bg);display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:6px 16px;font-size:12px')}>
        <div style={sx('display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;font-size:11px')}>
          <span style={sx('width:10px;height:10px;background:var(--color-accent);display:inline-block')} />
          <span>Prototype</span>
        </div>
        <div style={sx('display:flex;border:1px solid var(--color-neutral-700)')}>
          {tabs.map(([label, area, page]) => (
            <button key={area} onClick={() => DA.go(area, page)} style={{ ...sx('font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border:0;cursor:pointer;color:var(--color-bg)'), background: a === area ? 'var(--color-accent)' : 'transparent' }}>{label}</button>
          ))}
        </div>
        <div style={sx('display:flex;gap:6px;flex-wrap:wrap')}>
          <button className="hover-ink-bg" onClick={() => { DA.loginCustomer('c1'); DA.go('customer', 'dashboard'); DA.toast('Signed in as Juan Dela Cruz'); }} style={barBtn}>Login as Customer</button>
          <button className="hover-ink-bg" onClick={() => { DA.loginAdmin('s2'); DA.go('admin', 'dashboard'); DA.toast('Signed in as Carla Mendoza (Manager)'); }} style={barBtn}>Login as Admin</button>
        </div>
        <div style={sx('margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap')}>
          <span style={sx('color:var(--color-neutral-400)')}>{sessionLabel}</span>
          <select value="" onChange={e => onPreset(e.target.value)} style={sx('font:inherit;font-size:12px;padding:4px 6px;background:var(--color-neutral-900);color:var(--color-bg);border:1px solid var(--color-neutral-700)')}>
            <option value="">Jump demo to…</option>
            <option value="Submitted">Vios submitted</option>
            <option value="Offer Sent">Offer sent (₱570,000)</option>
            <option value="Offer Accepted">Offer accepted</option>
            <option value="Inspection Completed">Inspection completed</option>
          </select>
          <button onClick={() => setGuide(g => !g)} style={barBtn}>Demo script</button>
          <button onClick={reset} style={sx('font:inherit;font-size:12px;padding:5px 10px;border:0;background:transparent;color:var(--color-accent-400);cursor:pointer;text-decoration:underline')}>Reset</button>
        </div>
      </div>
      {guide && (
        <div style={sx('position:fixed;top:56px;right:16px;z-index:70;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 80px);overflow:auto;background:var(--color-bg);border:2px solid var(--color-text);box-shadow:var(--shadow-lg);padding:20px')}>
          <div style={sx('display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px')}>
            <div style={sx('font-weight:800;font-size:16px')}>Demo script</div>
            <button className="btn btn-ghost" onClick={() => setGuide(false)}>Close</button>
          </div>
          <ol style={sx('margin:0;padding-left:20px;font-size:13px;line-height:1.6;display:flex;flex-direction:column;gap:6px')}>
            {GUIDE_STEPS.map((g, i) => <li key={i}><strong>{g.area}</strong> — {g.text}</li>)}
          </ol>
        </div>
      )}
    </>
  );
}
