import { useRef, useState } from 'react';
import { BRAND, DEMO_MODE } from '../../config';
import { sx } from '../../lib/sx';
import { DA, now, uid } from '../../store';

type Mode = 'signin' | 'register' | 'forgot' | 'reset' | 'admin-login';
interface Field { key: string; label: string; type: string; placeholder: string; ac: string; ok?: string }

/** Customer sign-in, registration and password reset, plus the staff sign-in. */
export function Auth() {
  const S = DA.S, route = S.route;
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [modeState, setModeState] = useState<Mode | null>(null);
  const lastPage = useRef<string | null>(null);

  // Local mode switches (e.g. "Forgot password?") only apply while the route stays on the page they started from.
  const m: Mode = route.area === 'admin' ? 'admin-login'
    : route.area === 'customer' ? (modeState || 'signin')
    : (modeState && modeState !== route.page && lastPage.current === route.page ? modeState : route.page as Mode);

  const to = (next: Mode) => { lastPage.current = route.page; setModeState(next); setErr({}); setFormError(''); setSent(false); setDone(false); setV({}); };
  const set = (k: string) => (e: { target: { value: string } }) => { const val = e.target.value; setV(s => ({ ...s, [k]: val })); setErr(s => ({ ...s, [k]: '' })); setFormError(''); };
  const afterCustomer = () => { if (route.area === 'customer') DA.go(route.area, route.page, route.params); else DA.go('customer', 'dashboard'); };
  const pw = v.password || '';
  const score = +(pw.length >= 8) + +/[A-Z]/.test(pw) + +/\d/.test(pw) + +/[^A-Za-z0-9]/.test(pw);

  const cfg: Record<Mode, { title: string; subtitle: string; fields: Field[]; submit: string }> = {
    'signin': { title: 'Sign in', subtitle: 'Track your valuation, review offers and message your valuator.', fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', ac: 'email' }, { key: 'password', label: 'Password', type: 'password', placeholder: '', ac: 'current-password' }], submit: 'Sign in' },
    'register': { title: 'Create your account', subtitle: 'One account for every car you sell with us.', fields: [{ key: 'name', label: 'Full name', type: 'text', placeholder: 'Juan Dela Cruz', ac: 'name' }, { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', ac: 'email' }, { key: 'phone', label: 'Mobile number', type: 'tel', placeholder: '0917 555 0124', ac: 'tel' }, { key: 'password', label: 'Password', type: 'password', placeholder: 'At least 8 characters', ac: 'new-password' }, { key: 'confirm', label: 'Confirm password', type: 'password', placeholder: '', ac: 'new-password', ok: v.confirm && v.confirm === pw && pw.length >= 8 ? 'Passwords match' : '' }], submit: 'Create account' },
    'forgot': { title: 'Reset your password', subtitle: 'Enter the email you registered with and we’ll send you a reset link.', fields: [{ key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', ac: 'email' }], submit: 'Send reset link' },
    'reset': { title: 'Choose a new password', subtitle: 'For juan.delacruz@gmail.com', fields: [{ key: 'password', label: 'New password', type: 'password', placeholder: 'At least 8 characters', ac: 'new-password' }, { key: 'confirm', label: 'Confirm new password', type: 'password', placeholder: '', ac: 'new-password' }], submit: 'Update password' },
    'admin-login': { title: 'Staff sign in', subtitle: `${BRAND.name} operations portal. Use your company email.`, fields: [{ key: 'email', label: 'Work email', type: 'email', placeholder: 'name@' + BRAND.domain, ac: 'email' }, { key: 'password', label: 'Password', type: 'password', placeholder: '', ac: 'current-password' }], submit: 'Sign in to Operations' },
  };
  const c = cfg[m] || cfg.signin;

  const submit = () => {
    const e: Record<string, string> = {};
    c.fields.forEach(f => { if (!(v[f.key] || '').trim()) e[f.key] = 'Required'; });
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email address.';
    if ((m === 'register' || m === 'reset') && pw && pw.length < 8) e.password = 'Use at least 8 characters.';
    if ((m === 'register' || m === 'reset') && v.confirm && v.confirm !== pw) e.confirm = 'Passwords don’t match.';
    if (m === 'register' && v.phone && !/^(09|\+639)\d{9}$/.test(v.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter an 11-digit mobile number starting with 09.';
    if (m === 'register' && v.email && S.customers.some(x => x.email.toLowerCase() === v.email.toLowerCase())) e.email = 'An account with this email already exists. Sign in instead.';
    if (Object.keys(e).length) { setErr(e); return; }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      if (m === 'signin') {
        const cu = S.customers.find(x => x.email.toLowerCase() === v.email.toLowerCase());
        if (!cu || pw.length < 6) { setFormError('Email or password is incorrect. Try again or reset your password.'); return; }
        DA.loginCustomer(cu.id); DA.toast('Welcome back, ' + cu.first); afterCustomer();
      }
      if (m === 'register') {
        const [first, ...rest] = v.name.trim().split(' ');
        const cu = { id: uid('c'), first, last: rest.join(' '), name: v.name.trim(), email: v.email, phone: v.phone, city: '', registered: now(), source: 'Direct', contactPref: 'SMS', notes: [] };
        S.customers.push(cu); DA.loginCustomer(cu.id); DA.toast('Account created. Welcome, ' + first);
        if (S.draft) DA.go('public', 'sell'); else afterCustomer();
      }
      if (m === 'forgot') setSent(true);
      if (m === 'reset') setDone(true);
      if (m === 'admin-login') {
        const st = S.staff.find(x => x.email.toLowerCase() === v.email.toLowerCase());
        if (!st) { setFormError('No staff account for that email. Contact your administrator.'); return; }
        if (!st.active) { setFormError('This account is deactivated.'); return; }
        DA.loginAdmin(st.id); DA.toast('Signed in as ' + st.name);
        DA.go('admin', route.area === 'admin' ? route.page : 'dashboard', route.params);
      }
    }, 600);
  };

  const isAdmin = m === 'admin-login';
  const showForm = !sent && !done;
  const alt = isAdmin ? [{ text: 'Not staff?', link: 'Go to the public website', onClick: () => DA.go('public', 'home') }]
    : m === 'signin' ? [{ text: `New to ${BRAND.name}?`, link: 'Create an account', onClick: () => to('register') }]
    : [{ text: 'Already have an account?', link: 'Sign in', onClick: () => to('signin') }];
  const demo = isAdmin
    ? [{ label: 'Login as Admin (Carla · Manager)', onClick: () => { DA.loginAdmin('s2'); DA.go('admin', route.page === 'admin-login' ? 'dashboard' : route.page, route.params); } }, { label: 'John Reyes · Valuator', onClick: () => { DA.loginAdmin('s1'); DA.go('admin', 'dashboard'); } }]
    : [{ label: 'Login as Customer (Juan)', onClick: () => { DA.loginCustomer('c1'); DA.toast('Signed in as Juan Dela Cruz'); afterCustomer(); } }, { label: 'Staff sign in', onClick: () => DA.go('admin', 'dashboard') }];

  return (
    <div style={sx('min-height:calc(100vh - 44px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));background:var(--color-bg);font-family:var(--font-body);color:var(--color-text)')}>
      <aside style={{ ...sx('color:var(--color-bg);padding:clamp(28px,5vw,64px);display:flex;flex-direction:column;justify-content:space-between;gap:40px'), background: isAdmin ? 'var(--color-text)' : 'var(--color-accent)' }}>
        <a onClick={() => DA.go('public', 'home')} style={sx('cursor:pointer;display:flex;align-items:center;gap:10px;font-weight:800;font-size:22px;color:var(--color-bg);text-decoration:none')}><span style={sx('width:14px;height:14px;background:var(--color-bg)')} />{BRAND.name}{isAdmin ? ' Operations' : ''}</a>
        <div>
          <div style={sx('font-weight:800;font-size:clamp(34px,4vw,56px);line-height:1.05;letter-spacing:-0.02em;margin-left:-0.04em')}>{isAdmin ? 'Every car, every offer, one queue.' : m === 'register' ? 'One account. Every car you sell.' : 'Sell your car the simple way.'}</div>
          <p style={sx('font-size:16px;line-height:1.6;max-width:44ch;margin:20px 0 0')}>{isAdmin ? 'Valuations, offers, inspections and purchases for Metro Manila, Cebu and Davao.' : 'Track your valuation, review your offer and message your valuator from one place.'}</p>
        </div>
        <div style={sx('font-size:13px')}>{isAdmin ? 'Access is logged. Internal financial data is permission-controlled.' : 'Your details are only shared with your assigned valuator.'}</div>
      </aside>
      <main style={sx('padding:clamp(28px,5vw,72px);display:flex;flex-direction:column;justify-content:center')}>
        <div style={sx('width:100%;max-width:420px;display:flex;flex-direction:column;gap:18px')}>
          {route.area === 'customer' && <div style={sx('border-left:6px solid var(--color-text);background:var(--color-surface);padding:12px 14px;font-size:14px')}>Sign in to open the customer portal.</div>}
          <h1 style={sx('font-size:36px;margin:0;letter-spacing:-0.02em')}>{sent ? 'Check your email' : done ? 'Password updated' : c.title}</h1>
          {showForm && <p style={sx('margin:-8px 0 0;font-size:15px;color:var(--color-neutral-800)')}>{c.subtitle}</p>}
          {formError && <div role="alert" style={sx('border-left:6px solid var(--color-accent);background:var(--color-accent-100);color:var(--color-accent-800);padding:12px 14px;font-size:14px')}>{formError}</div>}
          {showForm && (
            <>
              {c.fields.map(f => (
                <div key={m + f.key} className="field">
                  <label htmlFor={'au-' + f.key} style={sx('font-size:13px;font-weight:600;color:var(--color-neutral-800)')}>{f.label}</label>
                  <input id={'au-' + f.key} className="input" type={f.type} value={v[f.key] || ''} onChange={set(f.key)} onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder={f.placeholder} autoComplete={f.ac} aria-invalid={!!err[f.key]} style={{ ...sx('min-height:46px;font-size:15px'), borderColor: err[f.key] ? 'var(--color-accent)' : 'var(--color-divider)' }} />
                  {err[f.key] && <div style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600;margin-top:6px')}>{err[f.key]}</div>}
                  {f.ok && <div style={sx('font-size:12px;color:var(--color-neutral-800);margin-top:6px')}>✓ {f.ok}</div>}
                </div>
              ))}
              {(m === 'register' || m === 'reset') && pw.length > 0 && (
                <div style={sx('display:flex;gap:4px;align-items:center')}>
                  {[1, 2, 3, 4].map(i => <div key={i} style={{ flex: 1, height: 4, background: i <= score ? (score >= 3 ? 'var(--color-text)' : 'var(--color-accent)') : 'var(--color-neutral-300)' }} />)}
                  <span style={sx('font-size:12px;margin-left:8px;min-width:48px')}>{['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score]}</span>
                </div>
              )}
              {m === 'signin' && (
                <div style={sx('display:flex;justify-content:space-between;align-items:center;font-size:14px')}>
                  <label style={sx('display:flex;gap:8px;align-items:center;cursor:pointer')}><input type="checkbox" checked={remember} onChange={() => setRemember(r => !r)} style={sx('accent-color:var(--color-accent);width:16px;height:16px')} />Remember me</label>
                  <a onClick={() => to('forgot')} style={sx('cursor:pointer')}>Forgot password?</a>
                </div>
              )}
              <button className="btn btn-primary btn-block" onClick={submit} disabled={busy} style={sx('min-height:48px;font-size:15px;padding:12px 16px')}>{busy ? 'Please wait…' : c.submit}</button>
            </>
          )}
          {sent && (
            <div style={sx('display:flex;flex-direction:column;gap:12px;border-top:2px solid var(--color-text);padding-top:16px')}>
              <p style={sx('margin:0;font-size:15px;line-height:1.6')}>If an account exists for <strong>{v.email}</strong>, you’ll receive a reset link within a few minutes. The link expires in 30 minutes.</p>
              {DEMO_MODE && <button className="btn btn-secondary" onClick={() => to('reset')} style={sx('align-self:flex-start')}>Open reset link (demo)</button>}
            </div>
          )}
          {done && (
            <div style={sx('display:flex;flex-direction:column;gap:12px;border-top:2px solid var(--color-text);padding-top:16px')}>
              <p style={sx('margin:0;font-size:15px')}>Your password has been updated. Sign in with your new password.</p>
              <button className="btn btn-primary" onClick={() => to('signin')} style={sx('align-self:flex-start')}>Go to Sign In</button>
            </div>
          )}
          <div style={sx('display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-divider);padding-top:18px')}>
            {alt.map(a => <div key={a.link} style={sx('font-size:14px')}>{a.text} <a onClick={a.onClick} style={sx('cursor:pointer;font-weight:600')}>{a.link}</a></div>)}
            {DEMO_MODE && (
              <>
                <div style={sx('font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700);margin-top:6px')}>Prototype shortcuts</div>
                <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
                  {demo.map(d => <button key={d.label} className="btn btn-secondary" onClick={d.onClick}>{d.label}</button>)}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
