import { Fragment, useState } from 'react';
import { BRAND } from '../../config';
import { ImageSlot } from '../../components/ImageSlot';
import { sx } from '../../lib/sx';
import { useWidth } from '../../lib/useWidth';
import { DA, MAKES, fmt, now, type Article } from '../../store';

const PAGES: [string, string][] = [['Home', 'home'], ['Sell My Car', 'sellcar'], ['How It Works', 'how'], ['Articles', 'articles'], ['FAQ', 'faq'], ['Contact', 'contact']];
const YEARS = Array.from({ length: 17 }, (_, i) => String(2026 - i));
const CATS = ['All', 'Selling tips', 'Paperwork', 'Financing', 'Market'];

const FAQS: [string, string][] = [
  ['How is my offer calculated?', 'A valuator compares your car against recent sales and auction results for the same model, year and mileage, then adjusts for condition, service history and any repairs we need to make. You see one clear number, valid for 8 days.'],
  ['Is there any fee or obligation?', 'No. The valuation is free and you can decline the offer at any time before the sale agreement is signed.'],
  ['Can I sell a car that still has a loan?', 'Yes. Tell us the bank and outstanding balance. We settle the loan directly with the bank and pay you the difference.'],
  ['What happens at the inspection?', 'An inspector visits your address or you visit one of our centres. It takes about 45 minutes and confirms what you told us in your submission. If something differs, we explain any change to the offer before you agree.'],
  ['How and when do I get paid?', 'By bank transfer, usually within one business day of signing the Deed of Sale and handing over the car.'],
  ['Which documents do I need?', 'Original OR/CR, two valid government IDs, and the Release of Chattel Mortgage if the car was financed. We prepare the Deed of Sale and process the LTO transfer.'],
  ['Do you buy cars outside Metro Manila?', 'We currently buy in Metro Manila, Rizal, Cebu City and Davao City.'],
  ['Can I keep driving the car until payment?', 'Yes. You keep the car until the day we pay.'],
];
const STATS = [{ n: '2 hrs', l: 'Typical time to offer' }, { n: '₱0', l: 'Listing or service fees' }, { n: '1 day', l: 'Bank transfer after signing' }, { n: '4,200+', l: 'Cars bought since 2019' }];
const STEPS = [
  { n: '01', t: 'Tell us about your car', d: 'Make, model, mileage and condition. About six minutes.' },
  { n: '02', t: 'Upload photos', d: 'Seven required angles from your phone. We guide each one.' },
  { n: '03', t: 'Receive our valuation', d: 'A valuator reviews your car and sends a written offer.' },
  { n: '04', t: 'Accept your offer', d: 'Accept, ask a question or decline. No pressure, no obligation.' },
  { n: '05', t: 'Inspection and payment', d: 'We inspect, you sign, and we pay by bank transfer.' },
];
const STEPS_LONG = [
  { n: '01', t: 'Tell us about your car', d: 'Enter your plate number, make, model, variant and mileage, then answer a few questions about condition and ownership. Save and come back any time.', meta: 'About 6 minutes' },
  { n: '02', t: 'Upload photos', d: 'Seven required photos: front, rear, both sides, interior, dashboard and odometer. Add engine bay, wheels and any damage if you can; it tightens the offer.', meta: 'Drag and drop, or shoot straight from your phone' },
  { n: '03', t: 'Receive our valuation', d: 'A named valuator reviews your submission against recent sales and auction data. You get one written offer, valid for 8 days.', meta: 'Usually within 2 business hours' },
  { n: '04', t: 'Accept your offer', d: 'Accept in one click, ask the valuator a question, or decline with no obligation. If you have new information, such as service receipts, send it and we review again.', meta: 'Chat with your valuator in the portal' },
  { n: '05', t: 'Inspection and payment', d: `Book a 45-minute inspection at home or at a ${BRAND.name} centre. We confirm the final offer, you sign the Deed of Sale, and we pay by bank transfer. We handle the LTO transfer.`, meta: 'Payment within 1 business day' },
];
const WHY = [
  { t: 'Fast valuation', d: 'A named valuator reviews your car the same day. Most offers arrive within two business hours of submission.' },
  { t: 'No listing fees', d: 'No ads, no commissions, no premium placements. The offer you accept is what lands in your account.' },
  { t: 'Secure transaction', d: 'Payment by bank transfer to an account in the registered owner’s name. No cash handovers, no strangers at your door.' },
  { t: 'Transparent process', d: 'You see every step in your account, and if the offer changes after inspection we show exactly why.' },
  { t: 'Simple paperwork', d: 'We prepare the Deed of Sale, settle any car loan with your bank and process the LTO transfer.' },
];
const TESTIMONIALS = [
  { q: 'Offer came in before lunch. Inspection on Saturday, money in my BPI account Monday morning.', who: 'Ramon B., sold a 2018 Montero Sport' },
  { q: 'They paid off my remaining BDO loan directly. I didn’t have to go to the bank once.', who: 'Katrina V., sold a 2020 Fortuner' },
  { q: 'The final offer dropped ₱30K after inspection, but they showed me the tire readings. Fair.', who: 'Patricia G., sold a 2019 Navara' },
];
const NEEDS = ['Plate number and current mileage', 'Seven photos from your phone', 'OR/CR details and loan balance, if any', 'About six minutes'];

type QS = { make: string; model: string; year: string; plate: string };

export function Marketing() {
  const S = DA.S, page = S.route.page, params = S.route.params;
  const w = useWidth();
  const wide = w > 980;
  const [menu, setMenu] = useState(false);
  const [qs, setQs] = useState<QS>({ make: '', model: '', year: '', plate: '' });
  const [faqOpen, setFaqOpen] = useState(0);
  const [cat, setCat] = useState('All');
  const [contact, setContact] = useState({ name: '', email: '', phone: '', msg: '' });
  const [cErr, setCErr] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  const go = (p: string) => () => { setMenu(false); DA.go('public', p); };
  const startSell = () => { if (!S.draft) DA.setDraft(DA.emptyDraft()); DA.go('public', 'sell'); };
  const setQ = (k: keyof QS) => (e: { target: { value: string } }) => { const v = e.target.value; setQs(s => ({ ...s, [k]: v, ...(k === 'make' ? { model: '' } : {}) })); };
  const quickStart = () => {
    const d = S.draft || DA.emptyDraft();
    d.vehicle = { ...d.vehicle, make: qs.make || d.vehicle.make, model: qs.model || d.vehicle.model, year: qs.year || d.vehicle.year, plate: qs.plate || d.vehicle.plate };
    d.step = 0; DA.setDraft(d); DA.go('public', 'sell');
  };
  const links = PAGES.map(([label, p]) => ({ label, onClick: go(p), color: page === p || (p === 'articles' && page === 'article') ? 'var(--color-accent)' : 'inherit', weight: page === p ? 800 : 400 }));
  const signedIn = S.session.customerId;
  const signinLabel = signedIn ? 'My account' : 'Sign In';
  const toSignin = () => signedIn ? DA.go('customer', 'dashboard') : DA.go('public', 'signin');

  const published = S.articles.filter(a => a.status === 'Published' || (a.status === 'Scheduled' && a.date <= now())).sort((a, b) => b.date - a.date);
  const mapA = (a: Article) => ({ id: a.id, title: a.title, excerpt: a.excerpt, category: a.category, date: fmt.dateY(a.date), author: DA.staffName(a.author), slot: 'art-' + a.id, image: a.image, read: Math.max(2, Math.round(a.content.split(' ').length / 180) + 2) + ' min read', open: () => DA.go('public', 'article', { id: a.id }) });
  const faqItem = (x: [string, string], i: number) => ({ q: x[0], a: x[1], open: faqOpen === i, sign: faqOpen === i ? '−' : '+', toggle: () => setFaqOpen(o => o === i ? -1 : i) });
  const artRaw = page === 'article' ? S.articles.find(a => a.id === params.id) : undefined;
  const art = artRaw ? { ...mapA(artRaw), paras: artRaw.content.split(/\n\n+/), tags: artRaw.tags || [] } : null;
  const listed = published.filter(a => cat === 'All' || a.category === cat);
  const recent = S.submissions.filter(s => s.status === 'Purchased').map(s => ({ s, sale: DA.saleOf(s.id) })).filter(x => x.sale).sort((a, b) => b.sale!.agreed - a.sale!.agreed).slice(0, 4).map(({ s, sale }) => { const v = DA.veh(s); return { slot: 'bought-' + s.ref, ph: v.make + ' ' + v.model + ' photo', name: v.year + ' ' + v.make + ' ' + v.model, meta: fmt.km(v.mileage) + ' · ' + s.location, price: fmt.peso(sale!.price), date: fmt.date(sale!.agreed) }; });
  const cSet = (k: keyof typeof contact) => (e: { target: { value: string } }) => { const v = e.target.value; setContact(s => ({ ...s, [k]: v })); };
  const sendContact = () => {
    const e: Record<string, string> = {};
    if (!contact.name.trim()) e.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) e.email = 'Enter a valid email address.';
    if (contact.msg.trim().length < 10) e.msg = 'Tell us a little more (at least 10 characters).';
    setCErr(e); if (!Object.keys(e).length) { setSent(true); DA.toast(`Message sent to ${BRAND.name} support`); }
  };
  const contactInfo = [{ k: 'Email', v: S.settings.email }, { k: 'Phone', v: S.settings.phone }, { k: 'Hours', v: 'Mon–Sat, 8 AM – 6 PM' }, { k: 'Centre', v: '28 Scout Rallos St., Quezon City' }, { k: 'Cebu', v: 'IT Park, Lahug, Cebu City' }];
  const qsModels = qs.make ? MAKES[qs.make] : [];
  const errText = (m?: string) => m ? <div style={sx('font-size:12px;color:var(--color-accent-700);margin-top:4px')}>{m}</div> : null;

  const vehicleSelects = (
    <>
      <div className="field"><label>Make</label>
        <select className="input" value={qs.make} onChange={setQ('make')}><option value="">Select make</option>{Object.keys(MAKES).map(m => <option key={m} value={m}>{m}</option>)}</select>
      </div>
      <div style={sx('display:grid;grid-template-columns:1fr 1fr;gap:12px')}>
        <div className="field"><label>Model</label>
          <select className="input" value={qs.model} onChange={setQ('model')} disabled={!qs.make}><option value="">Select model</option>{qsModels.map(m => <option key={m} value={m}>{m}</option>)}</select>
        </div>
        <div className="field"><label>Year</label>
          <select className="input" value={qs.year} onChange={setQ('year')}><option value="">Year</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>
    </>
  );

  const faqList = (items: ReturnType<typeof faqItem>[], big: boolean) => items.map(f => (
    <div key={f.q} style={sx('border-bottom:2px solid var(--color-divider)')}>
      <button onClick={f.toggle} aria-expanded={f.open} className="hover-accent-text" style={sx(`all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;justify-content:space-between;gap:16px;padding:${big ? '20px' : '18px'} 0;font-weight:800;font-size:${big ? '18px' : '17px'}`)}>
        <span>{f.q}</span><span style={sx('font-size:22px;line-height:1')}>{f.sign}</span>
      </button>
      {f.open && <p style={sx(big ? 'margin:0 0 20px;font-size:15.5px;line-height:1.7;color:var(--color-neutral-800);max-width:66ch' : 'margin:0 0 18px;font-size:15px;line-height:1.7;color:var(--color-neutral-800);max-width:62ch')}>{f.a}</p>}
    </div>
  ));

  return (
    <div style={sx('background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)')}>
      <nav className="nav" style={sx('position:sticky;top:0;z-index:40;background:var(--color-bg);padding:14px clamp(20px,5vw,72px);flex-wrap:wrap')}>
        <a onClick={go('home')} className="nav-brand" style={sx('cursor:pointer;display:flex;align-items:center;gap:10px;font-size:22px;letter-spacing:-0.02em')}>
          <span style={sx('width:14px;height:14px;background:var(--color-accent);display:inline-block')} />{BRAND.name}
        </a>
        {wide && (
          <>
            {links.map(l => <a key={l.label} onClick={l.onClick} style={{ cursor: 'pointer', color: l.color, fontWeight: l.weight }}>{l.label}</a>)}
            <a onClick={toSignin} style={sx('cursor:pointer')}>{signinLabel}</a>
          </>
        )}
        <button className="btn btn-primary" onClick={startSell}>Get My Car Valued</button>
        {!wide && <button className="btn btn-secondary" onClick={() => setMenu(m => !m)} aria-label="Menu">{menu ? 'Close' : 'Menu'}</button>}
        {!wide && menu && (
          <div style={sx('flex-basis:100%;display:flex;flex-direction:column;border-top:2px solid var(--color-divider);margin-top:8px')}>
            {links.map(l => <a key={l.label} onClick={l.onClick} style={sx('cursor:pointer;padding:14px 0;border-bottom:1px solid var(--color-divider);font-size:17px;font-weight:600')}>{l.label}</a>)}
            <a onClick={toSignin} style={sx('cursor:pointer;padding:14px 0;font-size:17px;font-weight:600')}>{signinLabel}</a>
          </div>
        )}
      </nav>

      {page === 'home' && (
        <>
          <div style={sx('max-width:1200px;margin:0 auto;padding:0 clamp(20px,5vw,72px)')}>
            <section style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:48px;padding:clamp(48px,8vw,112px) 0 clamp(40px,6vw,84px);align-items:end')}>
              <div>
                <h1 style={sx('font-size:clamp(44px,6.4vw,88px);line-height:1.04;letter-spacing:-0.025em;margin:0 0 0 -0.05em')}>Sell your car<br />the simple way.</h1>
                <p style={sx('font-size:18px;line-height:1.6;max-width:52ch;margin:28px 0 0;color:var(--color-neutral-800)')}>Tell us about your car, upload a few photos and receive a written offer from our valuation team. No marketplace listings, no strangers test-driving, no haggling in parking lots. We inspect, pay by bank transfer and handle the LTO paperwork.</p>
                <div style={sx('display:flex;gap:12px;flex-wrap:wrap;margin-top:32px')}>
                  <button className="btn btn-primary" onClick={startSell} style={sx('padding:14px 22px;font-size:16px;min-width:220px;justify-content:flex-start')}>Get My Car Valued →</button>
                  <button className="btn btn-secondary" onClick={go('how')} style={sx('padding:14px 22px;font-size:16px')}>How It Works</button>
                </div>
              </div>
              <div style={sx('background:var(--color-surface);border-top:6px solid var(--color-accent);padding:24px;display:flex;flex-direction:column;gap:14px')}>
                <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);font-weight:600')}>Start your valuation</div>
                <div style={sx('font-weight:800;font-size:22px;line-height:1.2')}>What are you selling?</div>
                {vehicleSelects}
                <button className="btn btn-primary btn-block" onClick={quickStart} style={sx('padding:12px 14px;font-size:15px')}>Continue to valuation →</button>
                <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>Takes about 6 minutes. Free, no obligation to sell.</div>
              </div>
            </section>
            <hr className="hr" style={sx('margin:0')} />
            <section style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:28px;padding:44px 0')}>
              {STATS.map(s => (
                <div key={s.l}>
                  <div style={sx('font-weight:800;font-size:clamp(34px,3.4vw,48px);line-height:1;color:var(--color-accent);letter-spacing:-0.02em')}>{s.n}</div>
                  <div style={sx('font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700);margin-top:12px')}>{s.l}</div>
                </div>
              ))}
            </section>
            <hr className="hr" style={sx('margin:0')} />
          </div>
          <div style={sx('max-width:1200px;margin:0 auto;padding:0 clamp(20px,5vw,72px)')}>
            <section style={sx('padding:72px 0 56px')}>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:28px')}>
                <h2 style={sx('font-size:clamp(28px,3vw,40px);margin:0')}>How it works</h2>
                <button className="btn btn-ghost" onClick={go('how')}>The full process →</button>
              </div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));border-top:2px solid var(--color-text)')}>
                {STEPS.map(s => (
                  <div key={s.n} style={sx('padding:20px 20px 24px 0;border-bottom:2px solid var(--color-divider);display:flex;flex-direction:column;gap:10px')}>
                    <div style={sx('display:flex;align-items:center;gap:10px;font-weight:800;font-variant-numeric:tabular-nums')}><span style={sx('width:10px;height:10px;background:var(--color-accent)')} />{s.n}</div>
                    <div style={sx('font-weight:800;font-size:20px;line-height:1.2')}>{s.t}</div>
                    <p style={sx('margin:0;font-size:14px;line-height:1.6;color:var(--color-neutral-800)')}>{s.d}</p>
                  </div>
                ))}
              </div>
            </section>
            <section style={sx('padding:24px 0 64px')}>
              <div style={sx('font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:8px')}>Why sell with us</div>
              {WHY.map(w => (
                <div key={w.t} style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px 48px;padding:26px 0;border-bottom:2px solid var(--color-divider);align-items:baseline')}>
                  <div style={sx('font-weight:800;font-size:24px;letter-spacing:-0.01em')}>{w.t}</div>
                  <p style={sx('margin:0;font-size:15.5px;line-height:1.7;color:var(--color-neutral-800);max-width:58ch')}>{w.d}</p>
                </div>
              ))}
            </section>
            <section style={sx('padding:24px 0 72px')}>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:24px')}>
                <h2 style={sx('font-size:clamp(28px,3vw,40px);margin:0')}>Recently purchased</h2>
                <span style={sx('font-size:13px;color:var(--color-neutral-700)')}>Real prices paid to sellers this month</span>
              </div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:24px')}>
                {recent.map(r => (
                  <div key={r.slot} style={sx('display:flex;flex-direction:column;gap:12px')}>
                    <div className="grayscale" style={sx('aspect-ratio:4/3;position:relative;background:var(--color-surface)')}>
                      <ImageSlot id={r.slot} placeholder={r.ph} />
                    </div>
                    <div style={sx('display:flex;justify-content:space-between;gap:8px;align-items:baseline')}>
                      <div style={sx('font-weight:800;font-size:17px')}>{r.name}</div>
                      <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>{r.date}</div>
                    </div>
                    <div style={sx('display:flex;justify-content:space-between;border-top:2px solid var(--color-divider);padding-top:10px;font-size:13px')}>
                      <span style={sx('color:var(--color-neutral-700)')}>{r.meta}</span>
                      <strong style={sx('color:var(--color-accent-700)')}>{r.price}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section style={sx('background:var(--color-surface)')}>
            <div style={sx('max-width:1200px;margin:0 auto;padding:72px clamp(20px,5vw,72px);display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:40px')}>
              {TESTIMONIALS.map(t => (
                <figure key={t.who} style={sx('margin:0;display:flex;flex-direction:column;gap:18px;border-top:2px solid var(--color-text);padding-top:20px')}>
                  <blockquote style={sx('margin:0;font-weight:800;font-size:21px;line-height:1.35;letter-spacing:-0.01em')}>“{t.q}”</blockquote>
                  <figcaption style={sx('font-size:14px;color:var(--color-neutral-700);margin:0')}>— {t.who}</figcaption>
                </figure>
              ))}
            </div>
          </section>
          <div style={sx('max-width:1200px;margin:0 auto;padding:0 clamp(20px,5vw,72px)')}>
            <section style={sx('padding:72px 0 48px')}>
              <div style={sx('display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;margin-bottom:24px')}>
                <h2 style={sx('font-size:clamp(28px,3vw,40px);margin:0')}>Latest articles</h2>
                <button className="btn btn-ghost" onClick={go('articles')}>All articles →</button>
              </div>
              <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:28px')}>
                {published.slice(0, 3).map(mapA).map(a => (
                  <article key={a.id} onClick={a.open} className="hover-accent-text" style={sx('cursor:pointer;display:flex;flex-direction:column;gap:10px')}>
                    <div className="grayscale" style={sx('aspect-ratio:16/9;position:relative;background:var(--color-surface)')}><ImageSlot id={a.slot} placeholder="Article image" src={a.image} /></div>
                    <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700)')}>{a.category} · {a.date}</div>
                    <div style={sx('font-weight:800;font-size:20px;line-height:1.25')}>{a.title}</div>
                    <p style={sx('margin:0;font-size:14px;line-height:1.6;color:var(--color-neutral-800)')}>{a.excerpt}</p>
                  </article>
                ))}
              </div>
            </section>
            <section style={sx('padding:48px 0 80px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:40px')}>
              <div>
                <h2 style={sx('font-size:clamp(28px,3vw,40px);margin:0 0 12px')}>Questions sellers ask</h2>
                <button className="btn btn-ghost" onClick={go('faq')}>All FAQs →</button>
              </div>
              <div style={sx('border-top:2px solid var(--color-text)')}>{faqList(FAQS.slice(0, 5).map(faqItem), false)}</div>
            </section>
          </div>
        </>
      )}

      {page === 'how' && (
        <div style={sx('max-width:1200px;margin:0 auto;padding:clamp(48px,7vw,96px) clamp(20px,5vw,72px) 64px')}>
          <h1 style={sx('font-size:clamp(40px,5.5vw,72px);line-height:1.05;margin:0 0 20px;letter-spacing:-0.02em')}>How it works</h1>
          <p style={sx('font-size:18px;line-height:1.6;max-width:56ch;color:var(--color-neutral-800);margin:0 0 48px')}>Five steps from first form to money in your account. Most sellers finish within a week, and you can track every step in your account.</p>
          {STEPS_LONG.map(s => (
            <div key={s.n} style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px 48px;padding:32px 0;border-top:2px solid var(--color-divider)')}>
              <div style={sx('display:flex;gap:16px;align-items:baseline')}>
                <span style={sx('font-weight:800;font-size:44px;line-height:1;color:var(--color-accent)')}>{s.n}</span>
                <span style={sx('font-weight:800;font-size:24px;line-height:1.2')}>{s.t}</span>
              </div>
              <div style={sx('display:flex;flex-direction:column;gap:10px')}>
                <p style={sx('margin:0;font-size:16px;line-height:1.7')}>{s.d}</p>
                <div style={sx('font-size:13px;color:var(--color-neutral-700)')}>{s.meta}</div>
              </div>
            </div>
          ))}
          <div style={sx('border-top:2px solid var(--color-divider);padding-top:32px;display:flex;gap:12px;flex-wrap:wrap')}>
            <button className="btn btn-primary" onClick={startSell} style={sx('padding:14px 22px;font-size:16px')}>Get My Car Valued →</button>
            <button className="btn btn-secondary" onClick={go('faq')} style={sx('padding:14px 22px;font-size:16px')}>Read the FAQ</button>
          </div>
        </div>
      )}

      {page === 'sellcar' && (
        <div style={sx('max-width:1200px;margin:0 auto;padding:clamp(48px,7vw,96px) clamp(20px,5vw,72px) 72px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,380px),1fr));gap:56px')}>
          <div>
            <h1 style={sx('font-size:clamp(40px,5.5vw,72px);line-height:1.05;margin:0 0 20px;letter-spacing:-0.02em')}>Sell my car</h1>
            <p style={sx('font-size:18px;line-height:1.6;max-width:50ch;color:var(--color-neutral-800);margin:0 0 32px')}>Get a written offer for any car, SUV or pickup from 2010 onwards, including cars with an existing loan.</p>
            <div style={sx('font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:8px')}>Have these ready</div>
            {NEEDS.map(n => (
              <div key={n} style={sx('display:flex;gap:14px;padding:14px 0;border-top:1px solid var(--color-divider);font-size:15px')}><span style={sx('width:8px;height:8px;margin-top:8px;background:var(--color-accent);flex:none')} /><span>{n}</span></div>
            ))}
          </div>
          <div style={sx('background:var(--color-surface);border-top:6px solid var(--color-accent);padding:28px;display:flex;flex-direction:column;gap:14px;align-self:start')}>
            <div style={sx('font-weight:800;font-size:22px')}>Start with your plate number</div>
            <div className="field"><label>Plate / registration number</label><input className="input" value={qs.plate} onChange={setQ('plate')} placeholder="e.g. ABC 1234" style={sx('font-size:18px;text-transform:uppercase;letter-spacing:0.06em')} /></div>
            {vehicleSelects}
            <button className="btn btn-primary btn-block" onClick={quickStart} style={sx('padding:12px 14px;font-size:15px')}>Continue →</button>
          </div>
        </div>
      )}

      {page === 'articles' && (
        <div style={sx('max-width:1200px;margin:0 auto;padding:clamp(48px,7vw,96px) clamp(20px,5vw,72px) 72px')}>
          <h1 style={sx('font-size:clamp(40px,5.5vw,72px);line-height:1.05;margin:0 0 24px;letter-spacing:-0.02em')}>Articles</h1>
          <div style={sx('display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px')}>
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)} className="btn btn-secondary" style={{ background: cat === c ? 'var(--color-text)' : 'transparent', color: cat === c ? 'var(--color-bg)' : 'var(--color-text)' }}>{c}</button>
            ))}
          </div>
          <div style={sx('display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:36px 28px')}>
            {listed.map(mapA).map(a => (
              <article key={a.id} onClick={a.open} className="hover-accent-text" style={sx('cursor:pointer;display:flex;flex-direction:column;gap:10px;border-top:2px solid var(--color-text);padding-top:16px')}>
                <div className="grayscale" style={sx('aspect-ratio:16/9;position:relative;background:var(--color-surface)')}><ImageSlot id={a.slot} placeholder="Article image" src={a.image} /></div>
                <div style={sx('font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700)')}>{a.category} · {a.date}</div>
                <div style={sx('font-weight:800;font-size:22px;line-height:1.25')}>{a.title}</div>
                <p style={sx('margin:0;font-size:14px;line-height:1.6;color:var(--color-neutral-800)')}>{a.excerpt}</p>
                <div style={sx('font-size:12px;color:var(--color-neutral-700)')}>By {a.author} · {a.read}</div>
              </article>
            ))}
          </div>
          {listed.length === 0 && <p style={sx('padding:40px 0;color:var(--color-neutral-700)')}>No published articles in this category yet.</p>}
        </div>
      )}

      {page === 'article' && art && (
        <article style={sx('max-width:760px;margin:0 auto;padding:clamp(40px,6vw,80px) clamp(20px,5vw,40px) 72px')}>
          <button className="btn btn-ghost" onClick={go('articles')} style={sx('margin-bottom:24px')}>← All articles</button>
          <div style={sx('font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:14px')}>{art.category} · {art.date}</div>
          <h1 style={sx('font-size:clamp(34px,4.6vw,56px);line-height:1.08;letter-spacing:-0.02em;margin:0 0 20px')}>{art.title}</h1>
          <p style={sx('font-size:19px;line-height:1.6;color:var(--color-neutral-800);margin:0 0 28px')}>{art.excerpt}</p>
          <div style={sx('display:flex;gap:16px;font-size:13px;color:var(--color-neutral-700);border-top:2px solid var(--color-divider);border-bottom:2px solid var(--color-divider);padding:12px 0;margin-bottom:32px')}><span>By {art.author}</span><span>{art.read}</span></div>
          <div className="grayscale" style={sx('aspect-ratio:16/9;position:relative;background:var(--color-surface);margin-bottom:32px')}><ImageSlot id={art.slot} placeholder="Featured image" src={art.image} /></div>
          {art.paras.map((p, i) => <p key={i} style={sx('font-size:17px;line-height:1.75;margin:0 0 20px')}>{p}</p>)}
          <div style={sx('display:flex;gap:8px;flex-wrap:wrap;margin:28px 0 40px')}>{art.tags.map(t => <span key={t} className="tag tag-neutral">{t}</span>)}</div>
          <div style={sx('background:var(--color-accent);color:var(--color-bg);padding:28px;display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center')}>
            <div style={sx('font-weight:800;font-size:24px')}>Ready for a written offer?</div>
            <button className="btn" onClick={startSell} style={sx('background:var(--color-bg);color:var(--color-text);padding:12px 18px')}>Get My Car Valued →</button>
          </div>
        </article>
      )}

      {page === 'faq' && (
        <div style={sx('max-width:960px;margin:0 auto;padding:clamp(48px,7vw,96px) clamp(20px,5vw,72px) 72px')}>
          <h1 style={sx('font-size:clamp(40px,5.5vw,72px);line-height:1.05;margin:0 0 36px;letter-spacing:-0.02em')}>FAQ</h1>
          <div style={sx('border-top:2px solid var(--color-text)')}>{faqList(FAQS.map(faqItem), true)}</div>
        </div>
      )}

      {page === 'contact' && (
        <div style={sx('max-width:1200px;margin:0 auto;padding:clamp(48px,7vw,96px) clamp(20px,5vw,72px) 72px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:56px')}>
          <div>
            <h1 style={sx('font-size:clamp(40px,5.5vw,72px);line-height:1.05;margin:0 0 24px;letter-spacing:-0.02em')}>Contact</h1>
            <div style={sx('display:flex;flex-direction:column;border-top:2px solid var(--color-text)')}>
              {contactInfo.map(c => (
                <div key={c.k} style={sx('display:grid;grid-template-columns:120px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid var(--color-divider);font-size:15px')}><span style={sx('color:var(--color-neutral-700)')}>{c.k}</span><span style={sx('font-weight:600')}>{c.v}</span></div>
              ))}
            </div>
          </div>
          <div style={sx('background:var(--color-surface);padding:28px;display:flex;flex-direction:column;gap:14px;align-self:start')}>
            {sent ? (
              <div style={sx('display:flex;flex-direction:column;gap:12px')}>
                <div style={sx('font-weight:800;font-size:24px')}>Message sent.</div>
                <p style={sx('margin:0;font-size:15px')}>Thanks, {contact.name}. Our team replies within one business day, usually by {contact.phone ? 'SMS' : 'email'}.</p>
                <button className="btn btn-secondary" onClick={() => { setSent(false); setContact({ name: '', email: '', phone: '', msg: '' }); }} style={sx('align-self:flex-start')}>Send another</button>
              </div>
            ) : (
              <>
                <div style={sx('font-weight:800;font-size:22px')}>Send us a message</div>
                <div className="field"><label>Full name</label><input className="input" value={contact.name} onChange={cSet('name')} />{errText(cErr.name)}</div>
                <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px')}>
                  <div className="field"><label>Email</label><input className="input" type="email" value={contact.email} onChange={cSet('email')} />{errText(cErr.email)}</div>
                  <div className="field"><label>Mobile</label><input className="input" value={contact.phone} onChange={cSet('phone')} placeholder="09XX XXX XXXX" /></div>
                </div>
                <div className="field"><label>Message</label><textarea className="input" value={contact.msg} onChange={cSet('msg')} />{errText(cErr.msg)}</div>
                <button className="btn btn-primary btn-block" onClick={sendContact} style={sx('padding:12px 14px')}>Send message</button>
              </>
            )}
          </div>
        </div>
      )}

      <section style={sx('background:var(--color-accent);color:var(--color-bg)')}>
        <div style={sx('max-width:1200px;margin:0 auto;padding:clamp(56px,7vw,96px) clamp(20px,5vw,72px);display:flex;flex-direction:column;gap:32px')}>
          <h2 style={sx('font-size:clamp(36px,4.6vw,62px);line-height:1.05;margin:0 0 0 -0.05em;letter-spacing:-0.02em')}>Ready to sell your car?</h2>
          <div><button className="btn hover-accent-bg" onClick={startSell} style={sx('border:2px solid var(--color-bg);color:var(--color-bg);padding:14px 22px;font-size:16px;min-width:240px;justify-content:flex-start')}>Get My Valuation →</button></div>
        </div>
      </section>
      <footer style={sx('max-width:1200px;margin:0 auto;padding:40px clamp(20px,5vw,72px);display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:24px;font-size:13px;color:var(--color-neutral-700)')}>
        <div style={sx('display:flex;flex-direction:column;gap:6px')}><strong style={sx('color:var(--color-text);font-size:16px')}>{BRAND.name}</strong><span>{BRAND.legalName}</span><span>DTI-registered · SEC CS2019-0412</span></div>
        <div style={sx('display:flex;flex-direction:column;gap:6px')}>{links.map(l => <Fragment key={l.label}><a onClick={l.onClick} style={sx('cursor:pointer;color:inherit;text-decoration:none')}>{l.label}</a></Fragment>)}</div>
        <div style={sx('display:flex;flex-direction:column;gap:6px')}><span>{S.settings.email}</span><span>{S.settings.phone}</span><span>Mon–Sat, 8 AM – 6 PM</span></div>
        <div>© 2026 {BRAND.name}. Offers are subject to inspection.</div>
      </footer>
    </div>
  );
}
