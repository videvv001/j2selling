/* Reference data, status model, formatting helpers and the demo clock. */
import type { Status } from './types';

export const MAKES: Record<string, string[]> = {
  Toyota: ['Vios', 'Wigo', 'Raize', 'Corolla Altis', 'Innova', 'Fortuner', 'Hilux'],
  Honda: ['Brio', 'City', 'Civic', 'BR-V', 'CR-V'],
  Mitsubishi: ['Mirage', 'Mirage G4', 'Xpander', 'Montero Sport', 'Strada'],
  Ford: ['Territory', 'Ranger', 'Everest'],
  Nissan: ['Almera', 'Kicks', 'Navara', 'Terra'],
  Suzuki: ['Celerio', 'Swift', 'Dzire', 'Ertiga', 'Jimny'],
  Hyundai: ['Accent', 'Creta', 'Stargazer', 'Tucson'],
  Kia: ['Soluto', 'Stonic', 'Seltos', 'Sportage'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-30', 'CX-5', 'BT-50'],
  Isuzu: ['D-Max', 'mu-X'],
};
export const VARIANTS: Record<string, string[]> = {
  Vios: ['1.3 XE CVT', '1.3 XLE CVT', '1.5 G CVT', '1.5 GR-S CVT'],
  City: ['1.5 S CVT', '1.5 V CVT', '1.5 RS CVT'],
  Xpander: ['GLX MT', 'GLS AT', 'Cross AT'],
  Fortuner: ['2.4 G 4x2 AT', '2.8 V 4x2 AT', '2.8 LTD 4x4 AT'],
  _: ['Base MT', 'Mid-grade AT', 'Top-of-line AT'],
};
export const COLORS = ['White', 'Silver', 'Gray', 'Black', 'Red', 'Blue', 'Orange', 'Yellow', 'Brown', 'Green'];
export const CITIES = ['Quezon City', 'Makati', 'Pasig', 'Taguig', 'Mandaluyong', 'Manila', 'Parañaque', 'Las Piñas', 'Caloocan', 'Antipolo', 'Cebu City', 'Davao City'];
export const SOURCES = ['Google Ads', 'Facebook', 'Instagram', 'TikTok', 'Organic Search', 'Direct', 'Referral', 'Email', 'Partner', 'Other'];
export const REQUIRED_PHOTOS = ['Front', 'Rear', 'Driver side', 'Passenger side', 'Interior', 'Dashboard', 'Odometer'];
export const OPTIONAL_PHOTOS = ['Engine bay', 'Wheels', 'Registration / OR-CR', 'Damage / defects', 'Additional'];

/** Tone codes: n neutral, a action needed, o on track, k complete, x closed. Stage -1 = terminal. */
export type Tone = 'n' | 'a' | 'o' | 'k' | 'x';
export const STATUS: Record<Status, [number, Tone]> = {
  'Draft': [0, 'n'], 'Submitted': [1, 'n'], 'Under Review': [1, 'n'], 'More Information Required': [1, 'a'],
  'Valuation In Progress': [2, 'n'], 'Valuated': [2, 'n'], 'Offer Sent': [3, 'a'], 'Negotiating': [3, 'a'],
  'Offer Accepted': [4, 'o'], 'Inspection Scheduled': [4, 'o'], 'Inspection Completed': [4, 'o'], 'Final Offer': [4, 'a'],
  'Sale Agreed': [5, 'o'], 'Payment Processing': [5, 'o'], 'Purchased': [7, 'k'],
  'Customer Declined': [-1, 'x'], 'Company Declined': [-1, 'x'], 'Cancelled': [-1, 'x'], 'Expired': [-1, 'x'],
};
export const STATUS_ORDER = Object.keys(STATUS) as Status[];
export const CUSTOMER_LABEL: Partial<Record<Status, string>> = { 'Valuated': 'Valuation In Progress', 'Offer Sent': 'Offer Received', 'Company Declined': 'Not Accepted', 'Inspection Completed': 'Inspection Complete' };
export const CUSTOMER_STEPS = ['Submitted', 'Under Review', 'Valuation', 'Offer', 'Inspection', 'Payment', 'Completed'];
export const ACTIVE = (s: Status) => !!STATUS[s] && STATUS[s][0] >= 0 && s !== 'Purchased';
export const AWAITING: Status[] = ['Submitted', 'Under Review', 'Valuation In Progress'];

export const PERMISSIONS = ['View Vehicles', 'Edit Vehicles', 'Create Valuation', 'Approve Valuation', 'Send Offer', 'View Internal Financial Data', 'Manage Inspections', 'Manage Customers', 'Manage Articles', 'View Reports', 'Manage Staff', 'Manage Settings'];
export const ROLE_DEFAULTS: Record<string, string[]> = {
  'Super Admin': PERMISSIONS.slice(),
  'Manager': PERMISSIONS.filter(p => p !== 'Manage Settings'),
  'Valuator': ['View Vehicles', 'Edit Vehicles', 'Create Valuation', 'Send Offer', 'View Internal Financial Data', 'Manage Customers'],
  'Inspector': ['View Vehicles', 'Edit Vehicles', 'Manage Inspections'],
  'Content Editor': ['Manage Articles'],
  'Customer Support': ['View Vehicles', 'Manage Customers'],
};
export const CHECK_AREAS = ['Exterior', 'Interior', 'Engine', 'Transmission', 'Suspension & steering', 'Brakes', 'Tires', 'Electrical', 'Aircon', 'Documents match'];

/* ---------- demo clock ---------- */
// The demo starts at Sep 29 2026 10:30 (Manila) and advances with real time spent in the app.
export const NOW = new Date('2026-09-29T10:30:00+08:00').getTime();
export const H = 3600e3, DAY = 24 * H;
// The start point is saved with the demo data so the clock keeps moving forward across reloads.
let clockStart = Date.now();
export function setClockStart(t: number) { clockStart = t; }
export function getClockStart() { return clockStart; }
export function now(): number { return NOW + (Date.now() - clockStart); }
/** Parses a Manila-local ISO date or datetime. */
export const ts = (iso: string) => Date.parse(iso.length <= 10 ? iso + 'T09:00:00+08:00' : iso + '+08:00');

/* ---------- helpers ---------- */
export const pad = (n: number, l = 2) => String(n).padStart(l, '0');
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** All dates display in Manila time (UTC+8, no DST) regardless of the viewer's timezone; read fields with getUTC*. */
const MANILA_OFFSET = 8 * 3600e3;
export const manila = (t: number | string) => new Date((typeof t === 'number' ? t : Date.parse(t)) + MANILA_OFFSET);
const toD = manila;
/** Deterministic pseudo-random in [0,1) for stable sample data. */
export const noise = (i: number, s: number) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
export const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
export const initials = (n: string) => n.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

type T = number | string;
export const fmt = {
  peso: (n: number | string | null | undefined) => (n == null || n === '' || isNaN(+n)) ? '—' : '₱' + Math.round(+n).toLocaleString('en-PH'),
  pesoShort: (n: number) => n >= 1e6 ? '₱' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M' : n >= 1e3 ? '₱' + Math.round(n / 1e3) + 'K' : '₱' + n,
  num: (n: number) => Math.round(+n).toLocaleString('en-PH'),
  km: (n: number) => Math.round(+n).toLocaleString('en-PH') + ' km',
  pct: (n: number) => (+n).toFixed(1) + '%',
  date: (t: T) => { const d = toD(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate(); },
  dateY: (t: T) => { const d = toD(t); return MON[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); },
  dateLong: (t: T) => { const d = toD(t); return MONL[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(); },
  time: (t: T) => { const d = toD(t); let h = d.getUTCHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + pad(d.getUTCMinutes()) + ' ' + ap; },
  dateTime: (t: T) => fmt.date(t) + ', ' + fmt.time(t),
  ago: (t: T) => { const s = (now() - toD(t).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + 'm ago'; if (s < 86400) return Math.floor(s / 3600) + 'h ago'; if (s < 7 * 86400) return Math.floor(s / 86400) + 'd ago'; return fmt.date(t); },
  iso: (t: T) => { const d = toD(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); },
};
