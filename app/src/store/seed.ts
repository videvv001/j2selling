/* Sample data: 20 customers, 8 staff and 51 cases spread across every stage of the pipeline. */
import { BRAND } from '../config';
import {
  CHECK_AREAS, DAY, H, REQUIRED_PHOTOS, ROLE_DEFAULTS, STATUS, fmt, noise, now, pad, ts, uid,
} from './reference';
import type {
  Article, CheckResult, FactorImpact, HistoryEntry, Offer, State, Status,
} from './types';

export function defaultFactors(n: number): Record<string, FactorImpact> {
  return { Mileage: n % 3 ? 'Neutral' : 'Positive', Condition: 'Positive', 'Accident history': 'Neutral', 'Service history': 'Positive', 'Market demand': 'Positive', 'Vehicle age': 'Neutral', 'Repair requirements': 'Negative' };
}

export function defaultChecklist(issues: boolean): Record<string, CheckResult> {
  const o: Record<string, CheckResult> = {};
  CHECK_AREAS.forEach(a => (o[a] = 'Pass'));
  if (issues) { o['Tires'] = 'Attention'; o['Brakes'] = 'Attention'; }
  return o;
}

type OfferSpec = number | string;
type Row = [number, string, string, string, string, number, string, number, string, string, string, string, string | null, string, string, Status, OfferSpec[]];

export function seed(): State {
  const staffEmail = (name: string) => name.toLowerCase().replace(' ', '.') + '@' + BRAND.domain;
  const customers = ([
    ['c1', 'Juan', 'Dela Cruz', 'juan.delacruz@gmail.com', '0917 555 0124', 'Quezon City', '2024-03-12', 'Google Ads'],
    ['c2', 'Katrina', 'Villanueva', 'kat.villanueva@yahoo.com', '0918 221 4410', 'Makati', '2026-08-30', 'Facebook'],
    ['c3', 'Ramon', 'Bautista', 'rbautista@outlook.com', '0927 880 3172', 'Pasig', '2026-09-01', 'Organic Search'],
    ['c4', 'Grace', 'Lim', 'grace.lim@gmail.com', '0932 410 9981', 'Cebu City', '2026-09-05', 'Instagram'],
    ['c5', 'Miguel', 'Fernandez', 'miguel.fdz@gmail.com', '0917 302 6655', 'Taguig', '2026-09-08', 'Google Ads'],
    ['c6', 'Patricia', 'Gomez', 'pat.gomez@gmail.com', '0998 115 2033', 'Davao City', '2026-09-10', 'TikTok'],
    ['c7', 'Jerome', 'Aquino', 'jerome.aquino@gmail.com', '0915 776 0419', 'Antipolo', '2026-09-12', 'Referral'],
    ['c8', 'Liza', 'Mercado', 'liza.mercado@gmail.com', '0919 640 1288', 'Parañaque', '2026-07-21', 'Facebook'],
    ['c9', 'Carlo', 'Navarro', 'carlo.navarro@icloud.com', '0906 233 8710', 'Mandaluyong', '2026-09-16', 'Google Ads'],
    ['c10', 'Denise', 'Castillo', 'denise.castillo@gmail.com', '0917 998 1402', 'Las Piñas', '2026-09-18', 'Email'],
    ['c11', 'Benjie', 'Torres', 'benjie.torres@torreslogistics.ph', '0922 514 7736', 'Caloocan', '2026-08-02', 'Partner'],
    ['c12', 'Marissa', 'Santiago', 'marissa.santiago@gmail.com', '0917 442 9081', 'Marikina', '2026-04-11', 'Facebook'],
    ['c13', 'Eduardo', 'Ramirez', 'ed.ramirez@yahoo.com', '0928 116 7745', 'Muntinlupa', '2026-04-29', 'Organic Search'],
    ['c14', 'Angelica', 'Ocampo', 'angel.ocampo@gmail.com', '0919 508 3321', 'Iloilo City', '2026-05-16', 'Instagram'],
    ['c15', 'Francis', 'Tolentino', 'francis.tolentino@outlook.com', '0917 630 2294', 'Cagayan de Oro', '2026-05-30', 'Google Ads'],
    ['c16', 'Sheila', 'Pascual', 'sheila.pascual@gmail.com', '0995 271 8830', 'San Juan', '2026-06-20', 'Referral'],
    ['c17', 'Nathan', 'Uy', 'nathan.uy@gmail.com', '0918 774 1502', 'Pasay', '2026-07-08', 'TikTok'],
    ['c18', 'Rowena', 'Manalo', 'rowena.manalo@icloud.com', '0906 918 4467', 'Bacolod', '2026-07-27', 'Email'],
    ['c19', 'Dennis', 'Soriano', 'dennis.soriano@gmail.com', '0927 355 6019', 'Valenzuela', '2026-08-14', 'Google Ads'],
    ['c20', 'Trisha', 'Enriquez', 'trisha.enriquez@gmail.com', '0917 209 3358', 'Alabang', '2026-09-21', 'Facebook'],
  ] as const).map(([id, first, last, email, phone, city, reg, source]) => ({ id, first, last, name: first + ' ' + last, email, phone, city, registered: ts(reg), source, contactPref: 'SMS', notes: [] as State['customers'][number]['notes'] }));
  customers[0].notes = [{ id: 'cn1', by: 's1', ts: ts('2026-08-22T15:10'), text: 'Repeat seller. Prefers SMS, responds quickly. Sold City and Xpander with us.' }];

  const staff = ([
    ['s1', 'John Reyes', 'Valuator'],
    ['s2', 'Carla Mendoza', 'Manager'],
    ['s3', 'Paolo Lim', 'Inspector'],
    ['s4', 'Andrea Cruz', 'Valuator'],
    ['s5', 'Mark Villareal', 'Inspector'],
    ['s6', 'Bea Santos', 'Content Editor'],
    ['s7', 'Rico Tan', 'Customer Support'],
    ['s8', 'Liza Ramos', 'Super Admin'],
  ] as const).map(([id, name, role]) => ({ id, name, role, email: staffEmail(name), active: true, lastActive: now() - Math.floor(noise(id.length, 3) * 5 * H) }));

  const S0: State = {
    customers, staff, vehicles: [], submissions: [], photos: [], conditions: [], ownerships: [], valuations: [], offers: [],
    messages: [], inspections: [], sales: [], payments: [], statusHistory: [], notes: [], activity: [], notifications: [], documents: [],
    roles: JSON.parse(JSON.stringify(ROLE_DEFAULTS)), articles: seedArticles(), live: { sub: 0, rev: 0, val: 0, off: 0, acc: 0, pur: 0, value: 0 },
    session: { customerId: null, adminId: null }, route: { area: 'public', page: 'home', params: {} }, draft: null, nextRef: 136,
    settings: { company: BRAND.legalName, offerValidity: 8, attentionHours: 2, email: BRAND.email, phone: BRAND.phone, bank: 'BPI · Corporate' },
  };

  const rows: Row[] = [
    // ref, cust, make, model, variant, year, plate, km, color, trans, fuel, loc, staff, source, submitted, status, offers
    [61, 'c1', 'Mitsubishi', 'Xpander', 'GLS AT', 2019, 'NDA 4521', 58200, 'Silver', 'Automatic', 'Gasoline', 'Quezon City', 's1', 'Google Ads', '2026-06-14T10:12', 'Purchased', [585000]],
    [98, 'c1', 'Honda', 'City', '1.5 E CVT', 2019, 'NBC 7810', 47900, 'White', 'CVT', 'Gasoline', 'Quezon City', 's4', 'Google Ads', '2026-08-19T14:40', 'Purchased', [530000, 'c560000', 545000]],
    [100, 'c11', 'Toyota', 'Hilux', '2.4 G 4x2 AT', 2019, 'NAL 1150', 91000, 'Gray', 'Automatic', 'Diesel', 'Caloocan', 's1', 'Partner', '2026-08-28T09:05', 'Purchased', [905000]],
    [102, 'c8', 'Mazda', 'Mazda2', '1.5 Premium AT', 2020, 'NCQ 2281', 44100, 'Red', 'Automatic', 'Gasoline', 'Parañaque', 's4', 'Facebook', '2026-08-30T16:20', 'Expired', [590000]],
    [105, 'c2', 'Toyota', 'Fortuner', '2.4 G 4x2 AT', 2020, 'NCX 3302', 61500, 'Black', 'Automatic', 'Diesel', 'Makati', 's1', 'Facebook', '2026-09-02T11:30', 'Purchased', [1250000, 'c1320000', 1280000]],
    [106, 'c3', 'Mitsubishi', 'Montero Sport', 'GLX 2.4 MT', 2018, 'ABK 9021', 88300, 'Gray', 'Manual', 'Diesel', 'Pasig', 's4', 'Organic Search', '2026-09-04T08:55', 'Payment Processing', [890000]],
    [107, 'c4', 'Honda', 'Civic', '1.5 RS Turbo CVT', 2021, 'GAB 1180', 29800, 'Red', 'CVT', 'Gasoline', 'Cebu City', 's1', 'Instagram', '2026-09-06T13:15', 'Sale Agreed', [1050000]],
    [108, 'c5', 'Ford', 'Ranger', '2.0 XLT 4x2 AT', 2021, 'NEF 6734', 54000, 'Blue', 'Automatic', 'Diesel', 'Taguig', 's4', 'Google Ads', '2026-09-09T10:40', 'Inspection Scheduled', [945000]],
    [109, 'c6', 'Nissan', 'Navara', '2.5 EL 4x2 AT', 2019, 'LAA 2218', 72400, 'White', 'Automatic', 'Diesel', 'Davao City', 's1', 'TikTok', '2026-09-11T15:05', 'Final Offer', [790000, 'c840000', 810000, 'f780000']],
    [110, 'c7', 'Suzuki', 'Ertiga', '1.5 GL AT', 2020, 'NGH 4409', 41200, 'Silver', 'Automatic', 'Gasoline', 'Antipolo', 's4', 'Referral', '2026-09-13T09:20', 'Offer Accepted', [565000]],
    [111, 'c8', 'Hyundai', 'Accent', '1.4 GL AT', 2019, 'DAE 7732', 63900, 'White', 'Automatic', 'Gasoline', 'Parañaque', 's1', 'Facebook', '2026-09-15T17:45', 'Negotiating', [420000, 'c460000']],
    [112, 'c9', 'Kia', 'Seltos', '1.4 EX Turbo AT', 2021, 'NIK 3345', 35600, 'Orange', 'Automatic', 'Gasoline', 'Mandaluyong', 's4', 'Google Ads', '2026-09-17T12:10', 'Offer Sent', [910000]],
    [113, 'c10', 'Mazda', 'CX-5', '2.0 FWD Pro AT', 2019, 'CAM 8812', 58700, 'Red', 'Automatic', 'Gasoline', 'Las Piñas', 's1', 'Email', '2026-09-19T10:00', 'Customer Declined', [1020000]],
    [114, 'c11', 'Isuzu', 'D-Max', '3.0 LS-A 4x2 AT', 2020, 'NBE 1006', 69200, 'White', 'Automatic', 'Diesel', 'Caloocan', 's4', 'Partner', '2026-09-20T14:25', 'Offer Sent', [1080000]],
    [115, 'c3', 'Toyota', 'Innova', '2.8 E AT', 2020, 'NAQ 5561', 77500, 'Silver', 'Automatic', 'Diesel', 'Pasig', 's1', 'Organic Search', '2026-09-22T09:35', 'Valuated', []],
    [116, 'c5', 'Toyota', 'Wigo', '1.0 G AT', 2022, 'NFR 2290', 18400, 'Yellow', 'Automatic', 'Gasoline', 'Taguig', 's4', 'Instagram', '2026-09-23T11:50', 'Valuation In Progress', []],
    [117, 'c2', 'Honda', 'BR-V', '1.5 V CVT', 2019, 'ABT 4488', 51300, 'Gray', 'CVT', 'Gasoline', 'Makati', 's1', 'Direct', '2026-09-24T16:05', 'More Information Required', []],
    [118, 'c8', 'Mitsubishi', 'Mirage G4', 'GLS CVT', 2021, 'NHQ 7710', 27000, 'Red', 'CVT', 'Gasoline', 'Parañaque', 's4', 'TikTok', '2026-09-25T10:30', 'Under Review', []],
    [119, 'c6', 'Ford', 'Everest', 'Titanium 2.0 4x2 AT', 2020, 'LCD 3321', 66800, 'Black', 'Automatic', 'Diesel', 'Davao City', 's1', 'Google Ads', '2026-09-26T13:40', 'Under Review', []],
    [120, 'c9', 'Nissan', 'Almera', '1.0 VL Turbo CVT', 2022, 'NLL 5520', 22100, 'White', 'CVT', 'Gasoline', 'Mandaluyong', 's4', 'Facebook', '2026-09-27T09:15', 'Company Declined', []],
    [121, 'c4', 'Suzuki', 'Swift', '1.2 GL CVT', 2020, 'GAE 9087', 39500, 'Blue', 'CVT', 'Gasoline', 'Cebu City', 's1', 'Google Ads', '2026-09-28T15:20', 'Submitted', []],
    [122, 'c7', 'Hyundai', 'Tucson', '2.0 GL AT', 2018, 'NDQ 6614', 83000, 'Silver', 'Automatic', 'Gasoline', 'Antipolo', null, 'Referral', '2026-09-28T19:55', 'Submitted', []],
    [123, 'c10', 'Kia', 'Stonic', '1.4 LX AT', 2022, 'NMT 2201', 15900, 'Gray', 'Automatic', 'Gasoline', 'Las Piñas', null, 'Instagram', '2026-09-29T08:10', 'Submitted', []],
    [62, 'c12', 'Toyota', 'Vios', '1.3 E CVT', 2018, 'NBK 2210', 62000, 'Silver', 'CVT', 'Gasoline', 'Marikina', 's1', 'Facebook', '2026-04-14T10:00', 'Purchased', [365000]],
    [63, 'c13', 'Honda', 'Jazz', '1.5 V CVT', 2017, 'ZAP 3308', 71500, 'Blue', 'CVT', 'Gasoline', 'Muntinlupa', 's4', 'Organic Search', '2026-05-02T13:20', 'Purchased', [355000, 'c380000', 370000]],
    [64, 'c14', 'Toyota', 'Rush', '1.5 G AT', 2019, 'IAB 5127', 55800, 'White', 'Automatic', 'Gasoline', 'Iloilo City', 's1', 'Instagram', '2026-05-18T09:45', 'Purchased', [640000]],
    [65, 'c15', 'Mitsubishi', 'Strada', 'GLS 2.4 4x2 AT', 2018, 'KDA 7741', 96000, 'Gray', 'Automatic', 'Diesel', 'Cagayan de Oro', 's4', 'Google Ads', '2026-06-01T15:10', 'Purchased', [720000]],
    [66, 'c16', 'Hyundai', 'Kona', '2.0 GLS AT', 2020, 'NJM 1902', 38400, 'Red', 'Automatic', 'Gasoline', 'San Juan', 's1', 'Referral', '2026-06-22T11:05', 'Purchased', [830000, 'c860000', 845000]],
    [67, 'c12', 'Suzuki', 'Celerio', '1.0 GL AT', 2019, 'NDB 4406', 43000, 'White', 'Automatic', 'Gasoline', 'Marikina', 's4', 'Direct', '2026-06-30T16:40', 'Purchased', [285000]],
    [68, 'c17', 'Toyota', 'Corolla Altis', '1.6 V CVT', 2018, 'NAC 8083', 66700, 'Black', 'CVT', 'Gasoline', 'Pasay', 's1', 'TikTok', '2026-07-10T10:25', 'Purchased', [610000]],
    [69, 'c18', 'Isuzu', 'mu-X', '3.0 LS-A 4x2 AT', 2019, 'BAC 6215', 81200, 'Silver', 'Automatic', 'Diesel', 'Bacolod', 's4', 'Email', '2026-07-29T14:00', 'Purchased', [1010000]],
    [70, 'c13', 'Ford', 'EcoSport', '1.5 Titanium AT', 2018, 'NDZ 9120', 68900, 'Orange', 'Automatic', 'Gasoline', 'Muntinlupa', 's1', 'Organic Search', '2026-08-04T09:30', 'Purchased', [455000]],
    [71, 'c19', 'Nissan', 'Terra', '2.5 VL 4x2 AT', 2020, 'NGT 3390', 59100, 'Brown', 'Automatic', 'Diesel', 'Valenzuela', 's4', 'Google Ads', '2026-08-16T12:15', 'Purchased', [1075000]],
    [72, 'c16', 'Honda', 'CR-V', '2.0 S CVT', 2019, 'NDF 5533', 60400, 'White', 'CVT', 'Gasoline', 'San Juan', 's1', 'Referral', '2026-08-22T10:50', 'Purchased', [980000]],
    [73, 'c14', 'Kia', 'Picanto', '1.2 EX AT', 2019, 'IAC 2044', 39800, 'Yellow', 'Automatic', 'Gasoline', 'Iloilo City', 's4', 'Instagram', '2026-06-08T13:35', 'Expired', [335000]],
    [74, 'c15', 'Toyota', 'Avanza', '1.3 E MT', 2017, 'KBA 1187', 90200, 'Silver', 'Manual', 'Gasoline', 'Cagayan de Oro', 's1', 'Google Ads', '2026-07-03T09:10', 'Customer Declined', [340000]],
    [75, 'c17', 'Mazda', 'Mazda3', '1.5 Sportback AT', 2018, 'NEA 6672', 74300, 'Gray', 'Automatic', 'Gasoline', 'Pasay', 's4', 'TikTok', '2026-07-19T17:20', 'Company Declined', []],
    [76, 'c18', 'Chevrolet', 'Trailblazer', '2.8 LT 4x2 AT', 2018, 'BAD 2801', 102000, 'Black', 'Automatic', 'Diesel', 'Bacolod', 's1', 'Email', '2026-08-08T11:00', 'Customer Declined', [780000]],
    [77, 'c19', 'Toyota', 'Fortuner', '2.4 V 4x4 AT', 2021, 'NHE 4471', 33700, 'White', 'Automatic', 'Diesel', 'Valenzuela', 's4', 'Google Ads', '2026-09-05T10:15', 'Purchased', [1640000, 'c1700000', 1670000]],
    [124, 'c20', 'BMW', '320i', 'Sport 2.0 AT', 2018, 'NCV 7702', 49300, 'Black', 'Automatic', 'Gasoline', 'Alabang', 's1', 'Facebook', '2026-09-22T09:00', 'Inspection Scheduled', [1320000]],
    [125, 'c12', 'Toyota', 'Vios', '1.5 G CVT', 2021, 'NFC 8826', 24100, 'White', 'CVT', 'Gasoline', 'Marikina', 's4', 'Direct', '2026-09-23T14:30', 'Offer Sent', [640000]],
    [126, 'c17', 'Honda', 'Civic', '1.8 E CVT', 2019, 'NDT 2519', 52200, 'Gray', 'CVT', 'Gasoline', 'Pasay', 's1', 'TikTok', '2026-09-24T10:45', 'Negotiating', [720000, 'c765000']],
    [127, 'c14', 'Ford', 'Territory', '1.5 Titanium+ AT', 2021, 'IAD 6008', 31500, 'Blue', 'Automatic', 'Gasoline', 'Iloilo City', 's4', 'Instagram', '2026-09-24T16:00', 'Offer Accepted', [880000]],
    [128, 'c19', 'Mitsubishi', 'Montero Sport', 'GT 2.4 4x2 AT', 2020, 'NIF 9301', 47800, 'White', 'Automatic', 'Diesel', 'Valenzuela', 's1', 'Google Ads', '2026-09-25T12:30', 'Valuation In Progress', []],
    [129, 'c20', 'Toyota', 'Raize', '1.0 Turbo CVT', 2022, 'NLW 3145', 17800, 'Red', 'CVT', 'Gasoline', 'Alabang', 's4', 'Facebook', '2026-09-26T09:50', 'Under Review', []],
    [130, 'c13', 'Suzuki', 'Jimny', '1.5 GLX MT', 2022, 'NLQ 7718', 12900, 'Green', 'Manual', 'Gasoline', 'Muntinlupa', 's1', 'Organic Search', '2026-09-26T18:05', 'Under Review', []],
    [131, 'c16', 'Hyundai', 'Creta', '1.5 GL IVT', 2022, 'NLB 5590', 20300, 'White', 'CVT', 'Gasoline', 'San Juan', 's4', 'Referral', '2026-09-27T11:25', 'Valuated', []],
    [132, 'c18', 'Toyota', 'Hiace', 'Commuter 3.0 MT', 2019, 'BAE 3327', 99000, 'White', 'Manual', 'Diesel', 'Bacolod', 's1', 'Email', '2026-09-27T15:40', 'Sale Agreed', [1030000]],
    [133, 'c15', 'Nissan', 'Navara', '2.5 VL 4x4 AT', 2021, 'KDB 2266', 41000, 'Gray', 'Automatic', 'Diesel', 'Cagayan de Oro', 's4', 'Google Ads', '2026-09-28T09:35', 'Submitted', []],
    [134, 'c20', 'Mazda', 'CX-30', '2.0 Sport AT', 2021, 'NHR 1180', 28700, 'Red', 'Automatic', 'Gasoline', 'Alabang', null, 'Facebook', '2026-09-29T07:45', 'Submitted', []],
    [135, 'c17', 'Kia', 'Sportage', '2.0 EX AT', 2018, 'NDV 4422', 70100, 'Silver', 'Automatic', 'Gasoline', 'Pasay', null, 'TikTok', '2026-09-29T09:20', 'Submitted', []],
  ];
  rows.forEach((r, i) => seedSubmission(S0, r, i));
  seedMessages(S0);
  seedMisc(S0);
  return S0;
}

function seedSubmission(S0: State, r: Row, i: number) {
  const [n, cust, make, model, variant, year, plate, km, color, trans, fuel, loc, staffId, source, subIso, status, offerSpec] = r;
  const id = 'sub' + n, ref = 'CAR-2026-' + pad(n, 5), t0 = ts(subIso);
  const vid = 'veh' + n;
  S0.vehicles.push({ id: vid, customerId: cust, make, model, variant, year, plate, mileage: km, color, transmission: trans, fuel, engine: fuel === 'Diesel' ? '2.4L Diesel' : '1.5L Gasoline' });
  S0.conditions.push({ id: 'cond' + n, submissionId: id, overall: ['Excellent', 'Good', 'Good', 'Fair'][i % 4], accident: n === 120 ? 'Yes' : 'No', accidentDetails: n === 120 ? 'Flood exposure during July typhoon; interior carpets replaced.' : '', mechanical: n === 111 ? 'Yes' : 'No', mechanicalDetails: n === 111 ? 'Aircon not cooling well at idle.' : '', warningLights: 'No', service: ['Full dealer history', 'Partial history', 'Full dealer history'][i % 3], keys: i % 3 === 0 ? '1' : '2', modifications: n === 108 ? 'Yes' : 'No', modificationDetails: n === 108 ? 'Aftermarket roll bar and tonneau cover.' : '', damage: ['None', 'Minor scratches', 'Small dent on rear bumper', 'None'][i % 4], info: '' });
  S0.ownerships.push({ id: 'own' + n, submissionId: id, registeredOwner: 'Yes, I am the registered owner', ownershipStatus: 'Fully paid', registration: 'Registered, up to date', financing: n === 106 ? 'Yes' : 'No', financeCompany: n === 106 ? 'BDO Auto Loans' : '', outstanding: n === 106 ? 180000 : 0, documents: ['OR/CR', 'Valid ID', 'Deed of Sale (prior)'], orcr: 'Original available', prevOwners: '1' });
  const photoTypes = n === 117 ? REQUIRED_PHOTOS.slice(0, 4) : n === 121 ? REQUIRED_PHOTOS.slice(0, 5).concat(['Engine bay']) : REQUIRED_PHOTOS.concat(['Engine bay', 'Wheels']);
  photoTypes.forEach((type, k) => S0.photos.push({ id: 'ph' + n + '_' + k, submissionId: id, type, url: null, flagged: n === 119 && type === 'Odometer', uploaded: t0 + 5 * 60e3 }));
  const sub = { id, ref, vehicleId: vid, customerId: cust, status, assignedTo: staffId, source, location: loc, submitted: t0, updated: t0, contactPref: 'SMS' };
  S0.submissions.push(sub);

  // Walk the status history forward from submission so every stage has a plausible timeline.
  const hist: HistoryEntry[] = [];
  const push = (s: Status, t: number, byId: string | null) => hist.push({ id: uid('h'), submissionId: id, status: s, ts: t, by: byId });
  push('Submitted', t0, null);
  const tgt = STATUS[status][0];
  let t = t0;
  const step = (h: number) => (t += h * H);
  if (status !== 'Submitted') push('Under Review', step(3), staffId);
  if (status === 'More Information Required') push(status, step(20), staffId);
  if (status === 'Company Declined') push(status, step(26), staffId);
  if (tgt >= 2 || ['Offer Sent', 'Negotiating', 'Customer Declined', 'Expired'].includes(status)) push('Valuation In Progress', step(4), staffId);

  const first = offerSpec.find((o): o is number => typeof o === 'number');
  if (status === 'Valuated' || first) {
    const market = status === 'Valuated' ? 1180000 : Math.round(first! * 1.09 / 5000) * 5000;
    const recommended = status === 'Valuated' ? 1085000 : first!;
    S0.valuations.push({ id: 'val' + n, submissionId: id, market, recommended, maximum: Math.round(recommended * 1.03 / 5000) * 5000, repair: 12000 + (n % 4) * 4000, recon: 8000 + (n % 3) * 3000, offer: recommended, factors: defaultFactors(n), notes: status === 'Valuated' ? 'Diesel Innovas moving fast in Pasig/QC. Recommend approval at ₱1.085M.' : 'Priced against 14 comparable listings and last 30 days of auction results.', status: status === 'Valuated' ? 'Draft' : 'Approved', by: staffId!, approvedBy: status === 'Valuated' ? null : 's2', ts: step(18) });
    push('Valuated', t, staffId);
  }

  let lastOffer: Offer | null = null;
  offerSpec.forEach((o, k) => {
    const isCounter = typeof o === 'string' && o[0] === 'c', isFinal = typeof o === 'string' && o[0] === 'f';
    const amount = typeof o === 'number' ? o : +o.slice(1);
    const type = isCounter ? 'Customer Counter' : isFinal ? 'Final Offer' : k === 0 ? 'Initial Offer' : 'Revised Offer';
    const ot = step(k === 0 ? 2 : 22);
    const off: Offer = { id: 'off' + n + '_' + k, submissionId: id, type, amount, by: isCounter ? cust : staffId!, byCustomer: isCounter, ts: ot, expires: ot + 8 * DAY, status: 'Superseded', notes: isCounter ? 'Customer requested via messages.' : isFinal ? 'Adjusted after inspection: worn rear tires, brake pads due.' : k === 0 ? '' : 'Met customer partway after reviewing service records.' };
    S0.offers.push(off); lastOffer = off;
    if (!isCounter && k === 0) push('Offer Sent', ot, staffId);
    if (isCounter) push('Negotiating', ot, cust);
  });
  const lo = lastOffer as Offer | null;
  // Keep a few live offers relative to "now" so expiry warnings always show in the demo.
  if (lo && n === 112) { lo.ts = now() - 7 * DAY; lo.expires = now() + 20 * H; }
  if (lo && n === 109) { lo.ts = now() - 20 * H; lo.expires = now() + 2.2 * DAY; }
  if (lo && n === 114) { lo.ts = now() - 2 * DAY; lo.expires = now() + 6 * DAY; }
  const accepted = ['Offer Accepted', 'Inspection Scheduled', 'Inspection Completed', 'Final Offer', 'Sale Agreed', 'Payment Processing', 'Purchased'].includes(status);
  if (lo) {
    if (status === 'Offer Sent' || status === 'Final Offer') lo.status = 'Pending';
    else if (status === 'Negotiating') lo.status = 'Countered';
    else if (status === 'Customer Declined') { lo.status = 'Declined'; lo.declineReason = 'Got a higher trade-in quote from a dealer.'; push('Customer Declined', step(30), cust); }
    else if (status === 'Expired') { lo.status = 'Expired'; push('Expired', lo.expires, null); }
    if (status === 'Final Offer') { const prev = S0.offers.filter(o => o.submissionId === id && o.type === 'Revised Offer').pop(); if (prev) prev.status = 'Accepted'; }
    if (accepted && status !== 'Final Offer') lo.status = 'Accepted';
    if (accepted) push('Offer Accepted', step(20), cust);
  }
  if (['Inspection Scheduled', 'Inspection Completed', 'Final Offer', 'Sale Agreed', 'Payment Processing', 'Purchased'].includes(status)) {
    const scheduled = status === 'Inspection Scheduled';
    const when = scheduled ? now() + 1 * DAY : step(26);
    push('Inspection Scheduled', step(4), staffId);
    S0.inspections.push({ id: 'ins' + n, submissionId: id, status: scheduled ? 'Scheduled' : 'Completed', date: fmt.iso(when), time: '10:00', location: loc + ' — customer address', inspector: n % 2 ? 's3' : 's5', checklist: scheduled ? {} : defaultChecklist(n === 109), findings: scheduled ? '' : n === 109 ? 'Rear tires at 30%. Front brake pads due. Otherwise clean.' : 'Vehicle matches submission. No undisclosed damage.', notes: '', recommended: null, ts: when });
    if (!scheduled) push('Inspection Completed', step(28), n % 2 ? 's3' : 's5');
    if (n === 109) push('Final Offer', step(3), staffId);
  }
  if (lo && ['Sale Agreed', 'Payment Processing', 'Purchased'].includes(status)) {
    const price = lo.amount;
    push('Sale Agreed', step(5), staffId);
    const stage = status === 'Purchased' ? 'Completed' : status === 'Payment Processing' ? 'Payment Processing' : 'Documents Pending';
    S0.sales.push({ id: 'sale' + n, submissionId: id, price, agreed: t, stage, staff: staffId, docs: { 'Signed Deed of Sale': status !== 'Sale Agreed', 'Original OR/CR': status !== 'Sale Agreed', 'Valid IDs (2)': true, 'Release of chattel mortgage': n !== 106 } });
    if (status !== 'Sale Agreed') {
      if (status === 'Payment Processing') push('Payment Processing', step(20), 's2');
      S0.payments.push({ id: 'pay' + n, saleId: 'sale' + n, amount: price, method: 'Bank transfer · BPI', status: status === 'Purchased' ? 'Paid' : 'Processing', ts: step(24), reference: 'BPI-' + (887000 + n) });
    }
    if (status === 'Purchased') push('Purchased', step(26), 's2');
  }
  sub.updated = hist[hist.length - 1].ts;
  S0.statusHistory.push(...hist);
  hist.forEach(h => S0.activity.push({ id: uid('a'), ts: h.ts, user: h.by, action: h.status === 'Submitted' ? 'Vehicle submitted' : 'Status changed', record: ref, details: h.status === 'Submitted' ? make + ' ' + model + ' ' + year : '→ ' + h.status }));
}

function seedMessages(S0: State) {
  const m = (sub: string, from: string, text: string, iso: string | number, read = true) => S0.messages.push({ id: uid('m'), submissionId: sub, from, text, ts: typeof iso === 'number' ? iso : ts(iso), readByAdmin: read, readByCustomer: true, attachment: null });
  m('sub98', 'c1', 'Hi, is ₱530,000 your best price? The car has complete Honda service records.', '2026-08-21T09:12');
  m('sub98', 's4', 'Thanks Juan. We reviewed the records and can move to ₱545,000.', '2026-08-21T11:40');
  m('sub98', 'c1', 'Deal. When can you inspect?', '2026-08-21T11:52');
  m('sub111', 'c8', 'The aircon was repaired last month, I can send the receipt.', '2026-09-24T14:10');
  m('sub111', 's1', 'Please do — a receipt would let us revisit the ₱420,000 offer.', '2026-09-24T15:02');
  m('sub111', 'c8', 'Uploaded. Can you do ₱460,000?', '2026-09-27T10:18', false);
  m('sub112', 'c9', 'Is there room to move on the offer? I have a buyer offering ₱950K.', now() - 3.2 * H, false);
  m('sub117', 's1', 'Hi Katrina, we need photos of the interior, dashboard and odometer to complete the valuation.', '2026-09-25T09:40');
  m('sub109', 's1', 'Final offer is ₱780,000 after inspection: rear tires and front brake pads are due. Details are in your Offer tab.', now() - 20 * H);
}

function seedMisc(S0: State) {
  S0.notes.push(
    { id: 'n1', submissionId: 'sub109', by: 's3', ts: now() - 22 * H, text: 'Tires 30% remaining; brake pads ~2mm. Adjust ₱30K.' },
    { id: 'n2', submissionId: 'sub115', by: 's1', ts: now() - 30 * H, text: 'Valuation drafted — needs Carla to approve before sending.' },
    { id: 'n3', submissionId: 'sub106', by: 's2', ts: now() - 50 * H, text: 'Outstanding loan with BDO ₱180,000. We settle directly; net to customer ₱710,000.' },
  );
  const na = (text: string, sub: string, ago: number, read = false) => S0.notifications.push({ id: uid('nt'), audience: 'admin', text, submissionId: sub, ts: now() - ago * H, read });
  na('New vehicle submitted — Kia Stonic 2022 (CAR-2026-00123)', 'sub123', 2.3);
  na('Customer sent a message — Carlo Navarro on CAR-2026-00112', 'sub112', 3.2);
  na('Offer expires tomorrow — Kia Seltos (CAR-2026-00112)', 'sub112', 4);
  na('Inspection completed — Nissan Navara (CAR-2026-00109)', 'sub109', 22, true);
  na('Customer accepted offer — Suzuki Ertiga (CAR-2026-00110)', 'sub110', 40, true);
  const nc = (text: string, sub: string, t: string) => S0.notifications.push({ id: uid('nt'), audience: 'customer', customerId: 'c1', text, submissionId: sub, ts: ts(t), read: true });
  nc('Your valuation is ready.', 'sub98', '2026-08-20T16:00');
  nc('You received an offer of ₱530,000.', 'sub98', '2026-08-20T16:01');
  nc('Your inspection is scheduled for Aug 24, 10:00 AM.', 'sub98', '2026-08-22T09:00');
  nc('Your payment has been processed. ₱545,000 sent to BPI ••4410.', 'sub98', '2026-08-27T14:30');
  S0.activity.push(
    { id: uid('a'), ts: now() - 26 * H, user: 's6', action: 'Article published', record: 'How mileage affects your car’s value', details: 'Category: Selling tips' },
    { id: uid('a'), ts: now() - 72 * H, user: 's8', action: 'Staff permissions changed', record: 'Role: Valuator', details: '+ Send Offer' },
    { id: uid('a'), ts: now() - 1.1 * H, user: 's1', action: 'Vehicle opened', record: 'CAR-2026-00119', details: 'Photos tab' },
  );
}

export const slugify = (title: string) => title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function seedArticles(): Article[] {
  const a = (id: string, title: string, category: string, author: string, status: Article['status'], date: string, views: number, excerpt: string, content: string, tags: string[]): Article =>
    ({ id, title, slug: slugify(title), category, author, status, date: ts(date), views, excerpt, content, tags, seoTitle: title + ' | ' + BRAND.name, seoDescription: excerpt, image: null });
  return [
    a('ar1', 'What documents you need to sell a car in the Philippines', 'Paperwork', 's6', 'Published', '2026-09-18', 4820, 'OR/CR, deed of sale, IDs and loan releases — a checklist so nothing holds up your payment.',
      'Most delays in a private car sale come from paperwork, not price. Before you book an inspection, gather your original Official Receipt (OR) and Certificate of Registration (CR), two valid government IDs, and a copy of the deed of sale if you bought the car second-hand.\n\nIf the car was financed, ask your bank for the Release of Chattel Mortgage. If the loan is still open, tell us the outstanding balance — we can settle it directly with the bank and pay you the difference.\n\nWe prepare the Deed of Absolute Sale for you and handle the LTO transfer after purchase.', ['OR/CR', 'LTO', 'Deed of sale']),
    a('ar2', 'How mileage affects your car’s value', 'Selling tips', 's6', 'Published', '2026-09-28', 1960, 'Why 20,000 km per year is the benchmark, and when high mileage matters less than you think.',
      'Valuators start from a benchmark of roughly 20,000 km per year. A 2022 car with 32,000 km is below average and is priced as such.\n\nMileage matters most for small hatchbacks and sedans. For diesel pickups and SUVs, a full service history can offset higher mileage.\n\nAlways photograph the odometer clearly; it is one of the seven required photos for a reason.', ['Mileage', 'Valuation']),
    a('ar3', 'Selling a car with an existing loan', 'Financing', 's7', 'Published', '2026-09-10', 3310, 'You can sell before the loan is paid off. Here is how the bank settlement works.',
      'If your car is still under financing, you can still sell it to us. Share the bank name and the outstanding balance in the Ownership step.\n\nWe request a payoff statement, pay the bank directly and transfer the balance to you once the chattel mortgage is released.', ['Car loan', 'Bank']),
    a('ar4', 'How to prepare your car for inspection', 'Selling tips', 's6', 'Published', '2026-09-02', 2745, 'A 15-minute checklist that keeps your final offer close to the first one.',
      'Our inspectors confirm what you told us in your submission. Clean the interior, keep both keys and your service booklet in the car, and make sure warning lights are addressed or disclosed.\n\nIf something has changed since you submitted, tell us before the inspection so we can adjust in advance.', ['Inspection']),
    a('ar5', 'Best-selling used cars in the Philippines, 2026', 'Market', 's6', 'Scheduled', '2026-10-05', 0, 'Vios, Mirage G4 and Innova still lead resale demand. What that means for your offer.',
      'Demand in the used market is still led by Toyota and Mitsubishi. We will publish the full list with average offers by model.', ['Market', 'Resale']),
    a('ar6', 'Five photos that speed up your valuation', 'Selling tips', 's6', 'Draft', '2026-09-27', 0, 'Front three-quarter, odometer, dashboard with ignition on, and two more.',
      'Draft — add examples for each photo angle.', ['Photos']),
    a('ar7', 'Rainy season: signs of flood damage', 'Market', 's7', 'Archived', '2025-07-15', 8120, 'What we look for and why flood exposure changes an offer.', 'Archived article.', ['Flood']),
  ];
}
