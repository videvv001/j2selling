/** Brand and build-time configuration. Rename the business here. */
export const BRAND = {
  /** Short name used in navigation bars and headings. */
  name: 'J2 AutoHaus',
  /** Registered business name used in legal copy and the footer. */
  legalName: 'J2 AutoHaus Auto Trading',
  domain: 'j2autohaus.ph',
  email: 'hello@j2autohaus.ph',
  phone: '(02) 8888 3475',
};

/**
 * Demo mode shows the dark prototype bar (area switcher, quick logins, demo script,
 * jump-to presets, reset) and the other prototype shortcuts sprinkled through the UI.
 * Disable with VITE_DEMO_MODE=false.
 */
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

export const STORE_KEY = 'j2autohaus-demo-v1';
