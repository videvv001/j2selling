import type { Route } from './store';

/* URL ⇄ route mapping. Routes are { area, page, params }; `id` goes in the path, other params in the query. */

const PUBLIC_PATHS: Record<string, string> = {
  home: '/', sellcar: '/sell-my-car', how: '/how-it-works', articles: '/articles', faq: '/faq', contact: '/contact',
  sell: '/sell', 'sell-success': '/sell/submitted', signin: '/signin', register: '/register', forgot: '/forgot-password',
  reset: '/reset-password', 'admin-login': '/staff-login',
};
const PUBLIC_PAGES = Object.fromEntries(Object.entries(PUBLIC_PATHS).map(([k, v]) => [v, k]));
const AREA_BASE = { customer: '/account', admin: '/admin' } as const;

export function routeToPath(r: Route): string {
  const { id, ...rest } = r.params || {};
  const query = new URLSearchParams(Object.entries(rest).filter((e): e is [string, string] => e[1] != null && e[1] !== '')).toString();
  let path: string;
  if (r.area === 'public') {
    path = r.page === 'article' ? '/articles/' + encodeURIComponent(id || '') : (PUBLIC_PATHS[r.page] || '/');
  } else {
    path = AREA_BASE[r.area] + (r.page === 'dashboard' && !id ? '' : '/' + r.page) + (id ? '/' + encodeURIComponent(id) : '');
  }
  return path + (query ? '?' + query : '');
}

export function pathToRoute(pathname: string, search: string): Route {
  const params: Record<string, string> = Object.fromEntries(new URLSearchParams(search));
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [first, page, id] = parts;
  if (first === 'account' || first === 'admin') {
    const area = first === 'account' ? 'customer' : 'admin';
    if (id) params.id = id;
    return { area, page: page || 'dashboard', params };
  }
  if (first === 'articles' && page) return { area: 'public', page: 'article', params: { ...params, id: page } };
  return { area: 'public', page: PUBLIC_PAGES['/' + parts.join('/')] || 'home', params };
}
