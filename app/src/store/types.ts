/* Domain model. Each entity is its own collection, linked by id (like tables in a database). */

export type Status =
  | 'Draft' | 'Submitted' | 'Under Review' | 'More Information Required'
  | 'Valuation In Progress' | 'Valuated' | 'Offer Sent' | 'Negotiating'
  | 'Offer Accepted' | 'Inspection Scheduled' | 'Inspection Completed' | 'Final Offer'
  | 'Sale Agreed' | 'Payment Processing' | 'Purchased'
  | 'Customer Declined' | 'Company Declined' | 'Cancelled' | 'Expired';

export interface CustomerNote { id: string; by: string; ts: number; text: string }

export interface Customer {
  id: string; first: string; last: string; name: string; email: string; phone: string; city: string;
  registered: number; source: string; contactPref: string; notes: CustomerNote[];
}

export interface Staff { id: string; name: string; role: string; email: string; active: boolean; lastActive: number }

export interface Vehicle {
  id: string; customerId: string; make: string; model: string; variant: string; year: number; plate: string;
  mileage: number; color: string; transmission: string; fuel: string; engine: string;
}

export interface Submission {
  id: string; ref: string; vehicleId: string; customerId: string; status: Status; assignedTo: string | null;
  source: string; location: string; address?: string; submitted: number; updated: number; contactPref: string;
  /** Created during this demo session (counts toward live KPI deltas). */
  live?: boolean;
}

export interface Photo { id: string; submissionId: string; type: string; url: string | null; flagged: boolean; uploaded: number }

export interface Condition {
  id: string; submissionId: string; overall: string; accident: string; accidentDetails: string; mechanical: string;
  mechanicalDetails: string; warningLights: string; warningDetails?: string; service: string; keys: string;
  modifications: string; modificationDetails: string; damage: string; info: string;
}

export interface Ownership {
  id: string; submissionId: string; registeredOwner: string; ownershipStatus: string; registration: string;
  financing: string; financeCompany: string; outstanding: number; documents: string[]; orcr: string; prevOwners: string;
}

export type FactorImpact = 'Positive' | 'Neutral' | 'Negative';

export interface ValuationFields {
  market: number; recommended: number; maximum: number; repair: number; recon: number; offer: number;
  factors: Record<string, FactorImpact>; notes: string;
}

export interface Valuation extends ValuationFields {
  id: string; submissionId: string; status: 'Draft' | 'Approved'; by: string; approvedBy?: string | null; ts: number;
}

export type OfferType = 'Initial Offer' | 'Revised Offer' | 'Final Offer' | 'Customer Counter';
export type OfferStatus = 'Pending' | 'Superseded' | 'Countered' | 'Accepted' | 'Declined' | 'Expired';

export interface Offer {
  id: string; submissionId: string; type: OfferType; amount: number; by: string; byCustomer: boolean; ts: number;
  expires: number; status: OfferStatus; notes: string; declineReason?: string; acceptedAt?: number;
}

export interface Message {
  id: string; submissionId: string; from: string; text: string; ts: number; readByAdmin: boolean; readByCustomer: boolean;
  attachment: string | null;
}

export type CheckResult = 'Pass' | 'Attention' | 'Fail';

export interface Inspection {
  id: string; submissionId: string; status: 'Scheduled' | 'In Progress' | 'Completed' | 'Failed' | 'Reschedule Required' | 'Cancelled';
  date?: string; time?: string; location?: string; inspector?: string; checklist: Record<string, CheckResult>;
  findings: string; damage?: string; notes: string; photos?: string[]; recommended: number | null; ts?: number; completedAt?: number;
}

export type SaleStage = 'Sale Agreed' | 'Documents Pending' | 'Payment Processing' | 'Paid' | 'Vehicle Received' | 'Completed';

export interface Sale {
  id: string; submissionId: string; price: number; agreed: number; stage: SaleStage; staff: string | null;
  docs: Record<string, boolean>;
}

export interface Payment { id: string; saleId: string; amount: number; method: string; status: 'Processing' | 'Paid'; ts: number; reference: string }

export interface HistoryEntry { id: string; submissionId: string; status: Status; ts: number; by: string | null; notified?: boolean }

export interface InternalNote { id: string; submissionId: string; by: string; ts: number; text: string }

export interface Activity { id: string; ts: number; user: string | null; action: string; record: string; details: string }

export interface Notification {
  id: string; audience: 'admin' | 'customer'; text: string; submissionId?: string; customerId?: string; ts: number; read: boolean;
}

export interface DocumentFile { id: string; submissionId: string; name: string; file: string; ts: number; by: string }

export type ArticleStatus = 'Draft' | 'Scheduled' | 'Published' | 'Archived';

export interface Article {
  id: string; title: string; slug: string; category: string; author: string; status: ArticleStatus; date: number;
  views: number; excerpt: string; content: string; tags: string[]; seoTitle: string; seoDescription: string; image: string | null;
}

export interface Settings {
  company: string; offerValidity: number; attentionHours: number; email: string; phone: string; bank: string;
  notifyNew?: boolean; notifyMsg?: boolean; notifyExpiry?: boolean; dailyDigest?: boolean;
}

export interface Route { area: 'public' | 'customer' | 'admin'; page: string; params: Record<string, string | undefined> }

export interface PhotoDraft { done?: boolean; progress?: number; url?: string | null }

export interface Draft {
  step: number; maxStep?: number; _saved?: number;
  vehicle: { plate: string; make: string; model: string; variant: string; year: string; transmission: string; fuel: string; engine: string; mileage: string; color: string };
  condition: { overall: string; accident: string; accidentDetails: string; mechanical: string; mechanicalDetails: string; warningLights: string; warningDetails: string; service: string; keys: string; modifications: string; modificationDetails: string; damage: string; info: string };
  ownership: { registeredOwner: string; ownershipStatus: string; registration: string; financing: string; financeCompany: string; outstanding: string; documents: string[]; orcr: string; prevOwners: string };
  photos: Record<string, PhotoDraft>;
  contact: { first: string; last: string; email: string; phone: string; city: string; location: string; pref: string; password: string; confirm: string; source: string };
}

export interface LiveCounters { sub: number; rev: number; val: number; off: number; acc: number; pur: number; value: number }

export interface PhotoRequest { submissionId: string; type: string; ts: number }

export interface State {
  customers: Customer[]; staff: Staff[]; vehicles: Vehicle[]; submissions: Submission[]; photos: Photo[];
  conditions: Condition[]; ownerships: Ownership[]; valuations: Valuation[]; offers: Offer[]; messages: Message[];
  inspections: Inspection[]; sales: Sale[]; payments: Payment[]; statusHistory: HistoryEntry[]; notes: InternalNote[];
  activity: Activity[]; notifications: Notification[]; documents: DocumentFile[];
  roles: Record<string, string[]>; articles: Article[]; live: LiveCounters;
  session: { customerId: string | null; adminId: string | null };
  route: Route; draft: Draft | null; nextRef: number; settings: Settings;
  /** Real time (ms) at which the demo clock read NOW; see reference.now(). */
  clockStart?: number;
  lastSubmitted?: string; photoRequests?: PhotoRequest[]; ui?: Record<string, unknown>;
}

export interface Toast { id: string; text: string; tone: string }

export interface DialogOptions {
  title: string; body?: string; confirmLabel: string; cancelLabel?: string;
  input?: 'textarea' | 'money' | null; inputLabel?: string; placeholder?: string; value?: string;
  onConfirm?: (value: string) => void;
}
