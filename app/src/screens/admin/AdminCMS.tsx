import { useRef, useState } from 'react';
import { BRAND } from '../../config';
import { readImageFile } from '../../lib/images';
import { sx } from '../../lib/sx';
import { DA, fmt, now, slugify, ts, uid, type Article, type ArticleStatus, type Status } from '../../store';

const TONE: Record<ArticleStatus, Status> = { Draft: 'Draft', Scheduled: 'Offer Accepted', Published: 'Purchased', Archived: 'Cancelled' };
const CATS = ['Selling tips', 'Paperwork', 'Financing', 'Market'];
const SEO_SUFFIX = ' | ' + BRAND.name;
const HATCH = 'repeating-linear-gradient(135deg,var(--color-neutral-300) 0 1px,var(--color-neutral-200) 1px 9px)';

interface Form {
  id: string; title: string; slug: string; excerpt: string; content: string; category: string; tags: string; author: string; date: string;
  seoTitle: string; seoDescription: string; image: string; status: ArticleStatus; views: number; isNew?: boolean;
}

/** Article list and editor. Published articles appear on the public site immediately. */
export function AdminCMS() {
  const S = DA.S, r = S.route;
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  if (r.page === 'article-edit') { const id = r.params.id || 'new'; return <ArticleEditor key={id} id={id} />; }

  const ql = q.trim().toLowerCase();
  const list = S.articles.filter(a => (filter === 'All' || a.status === filter) && (!ql || a.title.toLowerCase().includes(ql))).sort((a, b) => b.date - a.date);
  const archive = (a: Article) => {
    const ns: ArticleStatus = a.status === 'Archived' ? 'Draft' : 'Archived';
    DA.confirm({ title: (ns === 'Archived' ? 'Archive' : 'Restore') + ' “' + a.title + '”?', body: ns === 'Archived' ? 'It will be removed from the public site.' : 'It will be restored as a draft.', confirmLabel: ns === 'Archived' ? 'Archive' : 'Restore', onConfirm: () => { DA.saveArticle({ ...a, status: ns }); DA.toast('Article ' + (ns === 'Archived' ? 'archived' : 'restored')); } });
  };
  return (
    <div style={sx('display:flex;flex-direction:column;gap:18px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap')}>
        <div><h1 style={sx('font-size:30px;margin:0;letter-spacing:-0.02em')}>Articles</h1><div style={sx('font-size:13px;color:var(--color-neutral-700);margin-top:4px')}>Published articles appear on the public website automatically.</div></div>
        <div style={sx('display:flex;gap:8px')}><button className="btn btn-secondary" onClick={() => DA.go('public', 'articles')}>View public articles</button><button className="btn btn-primary" onClick={() => DA.go('admin', 'article-edit', { id: 'new' })}>New article</button></div>
      </div>
      <div style={sx('display:flex;gap:8px;flex-wrap:wrap;align-items:center')}>
        <div style={sx('display:flex;border:1px solid var(--color-divider)')}>
          {['All', 'Draft', 'Scheduled', 'Published', 'Archived'].map(x => <button key={x} onClick={() => setFilter(x)} style={{ ...sx('font:inherit;font-size:13px;padding:7px 12px;border:0;cursor:pointer'), background: filter === x ? 'var(--color-text)' : 'transparent', color: filter === x ? 'var(--color-bg)' : 'var(--color-text)' }}>{x} <span style={sx('opacity:.7')}>{x === 'All' ? S.articles.length : S.articles.filter(a => a.status === x).length}</span></button>)}
        </div>
        <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles" style={sx('max-width:260px;min-height:36px')} />
      </div>
      <div style={sx('overflow-x:auto;border-top:2px solid var(--color-text)')}><table className="table" style={sx('font-size:13px;min-width:900px')}>
        <thead><tr><th>Title</th><th>Category</th><th>Author</th><th>Status</th><th>Published date</th><th style={sx('text-align:right')}>Views</th><th style={sx('text-align:right')}>Actions</th></tr></thead>
        <tbody>{list.map(a => (
          <tr key={a.id}>
            <td style={sx('max-width:360px')}><a onClick={() => DA.go('admin', 'article-edit', { id: a.id })} style={sx('cursor:pointer;font-weight:700;color:var(--color-text);text-decoration:none')}>{a.title}</a><div style={sx('font-size:11.5px;color:var(--color-neutral-700)')}>/articles/{a.slug}</div></td>
            <td>{a.category}</td><td style={sx('white-space:nowrap')}>{DA.staffName(a.author)}</td>
            <td><span style={DA.badge(TONE[a.status]).style}>{a.status}</span></td><td style={sx('white-space:nowrap')}>{a.status === 'Draft' ? '—' : fmt.dateY(a.date)}</td><td style={sx('text-align:right;font-variant-numeric:tabular-nums')}>{a.views ? fmt.num(a.views) : '—'}</td>
            <td style={sx('text-align:right;white-space:nowrap')}>
              <button className="btn btn-ghost" onClick={() => DA.go('admin', 'article-edit', { id: a.id })} style={sx('font-size:12px')}>Edit</button>
              {a.status === 'Published' && <button className="btn btn-ghost" onClick={() => DA.go('public', 'article', { id: a.id })} style={sx('font-size:12px')}>View</button>}
              <button className="btn btn-ghost" onClick={() => archive(a)} style={sx('font-size:12px;color:var(--color-neutral-700)')}>{a.status === 'Archived' ? 'Restore' : 'Archive'}</button>
            </td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function initialForm(id: string): Form {
  const art = DA.S.articles.find(a => a.id === id);
  if (art) return { id: art.id, title: art.title, slug: art.slug, excerpt: art.excerpt, content: art.content, category: art.category, tags: (art.tags || []).join(', '), author: art.author, date: fmt.iso(art.date), seoTitle: art.seoTitle, seoDescription: art.seoDescription, image: art.image || '', status: art.status, views: art.views };
  return { id: uid('ar'), title: '', slug: '', excerpt: '', content: '', category: 'Selling tips', tags: '', author: 's6', date: fmt.iso(now()), seoTitle: '', seoDescription: '', image: '', status: 'Draft', views: 0, isNew: true };
}

function ArticleEditor({ id }: { id: string }) {
  const [fm, setFm] = useState<Form>(() => initialForm(id));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const authors = DA.S.staff.filter(x => ['Content Editor', 'Customer Support', 'Manager', 'Super Admin'].includes(x.role));

  // Slug, SEO title and SEO description follow the title/excerpt until someone edits them by hand.
  const set = (k: keyof Form) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    setFm(f0 => {
      const nf: Form = { ...f0, [k]: v };
      if (k === 'title') {
        if (!f0.slug || f0.slug === slugify(f0.title)) nf.slug = slugify(v);
        if (!f0.seoTitle || f0.seoTitle === f0.title + SEO_SUFFIX) nf.seoTitle = v + SEO_SUFFIX;
      }
      if (k === 'excerpt' && (!f0.seoDescription || f0.seoDescription === f0.excerpt)) nf.seoDescription = v;
      if (k === 'slug') nf.slug = slugify(v);
      return nf;
    });
    setDirty(true); setError('');
  };
  const build = (status: ArticleStatus, date = fm.date): Article => ({ id: fm.id, title: fm.title.trim(), slug: fm.slug || slugify(fm.title), excerpt: fm.excerpt, content: fm.content, category: fm.category, tags: fm.tags.split(',').map(x => x.trim()).filter(Boolean), author: fm.author, date: ts(date), seoTitle: fm.seoTitle, seoDescription: fm.seoDescription, image: fm.image || null, status, views: fm.views || 0 });
  const valid = () => { if (!fm.title || !fm.title.trim()) return 'Add a title before saving.'; if ((fm.content || '').trim().split(/\s+/).length < 5) return 'Content is too short to publish.'; return ''; };
  const save = (status: ArticleStatus, msg: string, date = fm.date) => {
    const e = status === 'Draft' ? (!fm.title || !fm.title.trim() ? 'Add a title before saving.' : '') : valid();
    if (e) { setError(e); return; }
    DA.saveArticle(build(status, date)); setDirty(false); setFm({ ...fm, date, status, isNew: false }); DA.toast(msg);
    if (fm.isNew) DA.go('admin', 'article-edit', { id: fm.id });
  };
  const wrap = (pre: string, post = '') => () => {
    const el = contentRef.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd, v = fm.content || '';
    setFm({ ...fm, content: v.slice(0, a) + pre + v.slice(a, b) + post + v.slice(b) }); setDirty(true);
  };
  const words = (fm.content || '').trim() ? fm.content.trim().split(/\s+/).length : 0;
  const isFuture = ts(fm.date || fmt.iso(now())) > now();
  const tools: [string, string, string, number][] = [['Paragraph', '\n\n', '', 400], ['Bold', '**', '**', 800], ['Heading', '\n\n## ', '', 800], ['List item', '\n• ', '', 400], ['Link', '[', '](https://)', 400]];
  const back = () => { if (dirty) DA.confirm({ title: 'Discard unsaved changes?', body: 'Your edits to this article haven’t been saved.', confirmLabel: 'Discard', onConfirm: () => { setDirty(false); DA.go('admin', 'articles'); } }); else DA.go('admin', 'articles'); };
  const publish = () => {
    const e = valid(); if (e) { setError(e); return; }
    const published = fm.status === 'Published';
    DA.confirm({ title: published ? 'Update published article?' : 'Publish now?', body: `It will appear on ${BRAND.domain}/articles immediately.`, confirmLabel: published ? 'Update' : 'Publish', onConfirm: () => save('Published', 'Published · live on the public site', isFuture ? fmt.iso(now()) : fm.date) });
  };
  const seoCount = (n: number, max: number) => <span style={{ fontWeight: 400, color: n > max ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>{n}/{max}</span>;

  return (
    <div style={sx('display:flex;flex-direction:column;gap:18px;font-family:var(--font-body);color:var(--color-text);font-size:14px')}>
      <div style={sx('display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap')}>
        <div style={sx('display:flex;gap:12px;align-items:center;flex-wrap:wrap')}><button className="btn btn-ghost" onClick={back}>← Articles</button><span style={DA.badge(TONE[fm.status] || 'Draft').style}>{fm.status || 'Draft'}</span>{dirty && <span style={sx('font-size:12px;color:var(--color-accent-700);font-weight:600')}>Unsaved changes</span>}</div>
        <div style={sx('display:flex;gap:8px;flex-wrap:wrap')}>
          <button className="btn btn-secondary" onClick={() => save('Draft', 'Draft saved')}>Save Draft</button>
          <button className="btn btn-secondary" onClick={() => setPreview(true)}>Preview</button>
          <button className="btn btn-secondary" onClick={() => { if (!isFuture) { setError('Pick a publish date in the future to schedule this article.'); return; } save('Scheduled', 'Scheduled for ' + fmt.dateLong(ts(fm.date))); }}>Schedule</button>
          <button className="btn btn-primary" onClick={publish}>{fm.status === 'Published' ? 'Update' : 'Publish'}</button>
        </div>
      </div>
      {error && <div role="alert" style={sx('border-left:6px solid var(--color-accent);background:var(--color-accent-100);color:var(--color-accent-800);padding:10px 14px;font-size:13.5px')}>{error}</div>}
      <div style={sx('display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:28px;align-items:start')}>
        <section style={sx('display:flex;flex-direction:column;gap:14px;grid-column:span 2;min-width:0')}>
          <div className="field"><label style={sx('font-weight:600')}>Title</label><input className="input" value={fm.title} onChange={set('title')} style={sx('font-size:22px;font-weight:800;min-height:48px')} /></div>
          <div className="field"><label style={sx('font-weight:600')}>Slug</label><div style={sx('display:flex;align-items:center;gap:0')}><span style={sx('padding:0 8px;font-size:13px;color:var(--color-neutral-700);background:var(--color-neutral-200);min-height:36px;display:flex;align-items:center;border:1px solid var(--color-divider);border-right:0')}>{BRAND.domain}/articles/</span><input className="input" value={fm.slug} onChange={set('slug')} /></div></div>
          <div className="field"><label style={sx('font-weight:600')}>Excerpt</label><textarea className="input" value={fm.excerpt} onChange={set('excerpt')} style={sx('min-height:64px')} /></div>
          <div className="field"><label style={sx('font-weight:600')}>Content</label>
            <div style={sx('display:flex;gap:4px;padding:4px;border:1px solid var(--color-divider);border-bottom:0;background:var(--color-surface)')}>
              {tools.map(([label, a, b, w]) => <button key={label} onClick={wrap(a, b)} style={{ ...sx('font:inherit;font-size:12px;padding:4px 8px;border:1px solid var(--color-divider);background:var(--color-bg);cursor:pointer'), fontWeight: w }}>{label}</button>)}
              <span style={sx('margin-left:auto;font-size:11.5px;color:var(--color-neutral-700);align-self:center;padding-right:6px')}>{words} words · blank line = new paragraph</span>
            </div>
            <textarea className="input" ref={contentRef} value={fm.content} onChange={set('content')} style={sx('min-height:320px;font-size:15px;line-height:1.7')} />
          </div>
        </section>
        <aside style={sx('display:flex;flex-direction:column;gap:14px;background:var(--color-surface);padding:16px')}>
          <div className="field"><label style={sx('font-weight:600')}>Featured image</label>
            <div onClick={() => imgRef.current?.click()} style={{ ...sx('aspect-ratio:16/9;cursor:pointer;border:1px dashed var(--color-neutral-500);display:grid;place-items:center;position:relative;overflow:hidden'), background: HATCH }}>
              {fm.image && <img src={fm.image} alt="Featured" style={sx('position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(1)')} />}
              <span style={sx('font-size:12px;background:var(--color-bg);padding:3px 8px;position:relative')}>{fm.image ? 'Replace image' : 'Upload featured image'}</span>
            </div>
            <input type="file" accept="image/*" ref={imgRef} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; readImageFile(file, 800).then(url => { if (url) { setFm(f0 => ({ ...f0, image: url })); setDirty(true); } }); }} style={sx('display:none')} />
          </div>
          <div className="field"><label style={sx('font-weight:600')}>Category</label><select className="input" value={fm.category} onChange={set('category')}>{CATS.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="field"><label style={sx('font-weight:600')}>Tags</label><input className="input" value={fm.tags} onChange={set('tags')} placeholder="Comma separated" /></div>
          <div className="field"><label style={sx('font-weight:600')}>Author</label><select className="input" value={fm.author} onChange={set('author')}>{authors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div className="field"><label style={sx('font-weight:600')}>Publish date</label><input className="input" type="date" value={fm.date} onChange={set('date')} /></div>
          <div style={sx('border-top:2px solid var(--color-divider);padding-top:12px;font-weight:800')}>SEO</div>
          <div className="field"><label style={sx('font-weight:600')}>SEO title {seoCount((fm.seoTitle || '').length, 60)}</label><input className="input" value={fm.seoTitle} onChange={set('seoTitle')} /></div>
          <div className="field"><label style={sx('font-weight:600')}>SEO description {seoCount((fm.seoDescription || '').length, 160)}</label><textarea className="input" value={fm.seoDescription} onChange={set('seoDescription')} style={sx('min-height:64px')} /></div>
          <div style={sx('background:var(--color-bg);padding:10px 12px;font-size:13px;display:flex;flex-direction:column;gap:2px')}><span style={sx('font-size:11px;color:var(--color-neutral-700)')}>{BRAND.domain} › articles › {fm.slug}</span><span style={sx('font-weight:700;color:var(--color-accent-700)')}>{fm.seoTitle}</span><span style={sx('color:var(--color-neutral-800)')}>{fm.seoDescription}</span></div>
        </aside>
      </div>

      {preview && (
        <div className="dialog-backdrop" style={sx('z-index:96;align-items:start;overflow:auto')} onClick={() => setPreview(false)}>
          <div onClick={e => e.stopPropagation()} style={sx('background:var(--color-bg);width:min(820px,100%);margin:24px auto;box-shadow:var(--shadow-lg)')}>
            <div style={sx('display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--color-text);color:var(--color-bg);font-size:13px')}><span>Preview · as it will appear on {BRAND.domain}</span><button onClick={() => setPreview(false)} style={sx('font:inherit;background:transparent;border:0;color:var(--color-bg);cursor:pointer')}>Close ✕</button></div>
            <article style={sx('padding:40px clamp(20px,5vw,56px) 56px')}>
              <div style={sx('font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-accent-700);margin-bottom:14px')}>{fm.category} · {fm.date ? fmt.dateY(ts(fm.date)) : ''}</div>
              <h1 style={sx('font-size:clamp(30px,4vw,48px);line-height:1.08;letter-spacing:-0.02em;margin:0 0 16px')}>{fm.title || 'Untitled article'}</h1>
              <p style={sx('font-size:18px;line-height:1.6;color:var(--color-neutral-800);margin:0 0 24px')}>{fm.excerpt}</p>
              <div style={sx('font-size:13px;color:var(--color-neutral-700);border-top:2px solid var(--color-divider);border-bottom:2px solid var(--color-divider);padding:10px 0;margin-bottom:24px')}>By {DA.staffName(fm.author)}</div>
              <div style={{ ...sx('aspect-ratio:16/9;margin-bottom:24px;position:relative;overflow:hidden'), background: HATCH }}>{fm.image && <img src={fm.image} alt="" style={sx('width:100%;height:100%;object-fit:cover;filter:grayscale(1)')} />}</div>
              {(fm.content || '').split(/\n\n+/).filter(Boolean).map((p, i) => <p key={i} style={sx('font-size:17px;line-height:1.75;margin:0 0 18px')}>{p}</p>)}
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
