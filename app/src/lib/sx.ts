import type { CSSProperties } from 'react';

/**
 * Converts a CSS declaration string into a React style object.
 *
 * The screens were designed as inline-styled HTML; keeping the declarations as written
 * makes it easy to diff the implementation against the design source. Results are cached
 * by string, so static styles are parsed once.
 */
const cache = new Map<string, CSSProperties>();

export function sx(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of splitDecls(css)) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop) continue;
    out[prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  if (cache.size < 5000) cache.set(css, out as CSSProperties);
  return out as CSSProperties;
}

/** Splits on semicolons that are not inside parentheses (e.g. data URIs, gradients). */
function splitDecls(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) {
      parts.push(css.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(css.slice(start));
  return parts;
}
