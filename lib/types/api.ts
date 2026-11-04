// Application models exchanged between the API routes and the UI. Database rows are mapped to
// these in lib/server/repositories; components only ever see these shapes.
import type { Lang } from '../i18n';
import type { Session } from '../farmer';
import type { City, ProductId, Channel } from '../demand';

export type AppStatus = 'submitted' | 'in_review' | 'more_info' | 'approved' | 'declined' | 'withdrawn';
export type ProgramStatus = 'submitted' | 'approved' | 'rejected' | 'concern' | 'published';
export type SendSlot = 'evening' | 'morning' | 'both';
export type SignalStatus = '-' | 'Interested' | 'Heard' | 'Not heard';

export interface QueryMsg { from: 'farmer' | 'society'; text: string; at: string }
export interface MemberQuery { id: string; code: string; lang: Lang; at: string; status: 'open' | 'resolved'; farmerSeen: boolean; farmerName?: string; messages: QueryMsg[] }

export interface Consent {
  id: string; code: string; recipient: string; lenderId: string | null; purpose: string; scope: string; period: string;
  grantedAt: string; status: 'active' | 'withdrawn'; withdrawnAt?: string;
  noticeVersion?: string; categories: string[]; method?: 'digital' | 'assisted'; language?: Lang; statements?: number;
}
export interface SharingLog { id: string; consentCode: string; recipient: string; categories: string[]; purpose: string; status: 'initiated' | 'completed' | 'failed'; at: string }
export type DocId = 'id' | 'bank' | 'quote' | 'kyc' | 'land' | 'credit';
export interface Application {
  id: string; ref: string; product: string; lender: string; lenderId: string; amount: number; tenure: number; rate: number; status: AppStatus;
  history: { status: AppStatus; at: string; note: string }[];
  docs: { id: DocId; status: 'received' | 'requested' | 'missing' }[];
  consentCode: string | null;
  sharing: SharingLog[];
}
export interface LoanProduct { id: string; lender: string; lenderId: string; name: string; purpose: string; min: number; max: number; rate: number; maxTenure: number; feePct: number; elig: string }
export interface KycRecord { type: string; masked: string; status: string; provider: string }
export interface PropertyRecord { ownership: string; survey: string; village: string; district: string; state: string; area: number; unit: string; use: string; record: string; status: string }
export interface CreditRecord { bureau: string; score: number; loans: number; outstanding: number; mock: boolean }
export interface Premium { programId: string; rate: number; from: string; to: string }

export interface FarmerProfile {
  id: string; code: string; name: string; phone: string | null; language: Lang; village: string;
  society: { id: string; code: string; name: string }; animals: { buffalo: number; cow: number }; correctionRequested: boolean;
}
export interface FarmerData {
  asOf: string;
  profile: FarmerProfile;
  sessions: Session[];
  premium: Premium | null;
  response: { heard: boolean; interested: boolean };
  queries: MemberQuery[];
  consents: Consent[];
  application: Application | null;
  finance: { kyc: KycRecord[]; property: PropertyRecord | null; credit: CreditRecord | null; products: LoanProduct[] };
}

export interface ProgramView {
  id: string; title: string; rate: number; from: string; to: string; status: ProgramStatus;
  submittedBy: string; approvedBy: string | null; justification: string | null; rejectedReason: string | null;
  concern: string | null; sendSlot: SendSlot | null; notes: Partial<Record<Lang, string>>; societyIds: string[];
  publishedAt: string | null;
}
export interface AuditEvent { at: string; actor: string; action: string }

export interface MemberRow {
  id: string; code: string; name: string; mobile: string | null; device: 'Smartphone' | 'Feature phone (IVR)'; lang: Lang;
  village: string; buffaloes: number; cows: number; litres: number; status: SignalStatus; isDemoFarmer?: boolean;
}
export interface SocietyData {
  asOf: string;
  society: { id: string; code: string; name: string; village: string; members: number };
  collection: { buffalo: number; cow: number } | null;
  monthly: { month: string; buffalo: number }[]; // average buffalo litres per day, by month up to asOf
  program: ProgramView | null;
  members: MemberRow[];
  reach: { heard: number; interested: number; app: number; voice: number };
  preview: { memberName: string; worth: number } | null;
  queries: MemberQuery[];
}

export interface ProductRow { id: ProductId | 'sink'; name: string; unit: string; milkPerUnit: number; valuePerLitre: number; capacity: number | null; buffaloShare: number; isFallback: boolean; isLiquidMilk: boolean }
export interface SocietyLite { id: string; code: string; name: string; members: number; buffaloLitres: number; region: string }
export interface ZoneRow { id: string; name: string; city: City; lat: number; lng: number; aff: number; inland: number; weight: number; qShare: number }
export interface SourceRow { id: string; name: string; kind: string; lag: string; grain: string; quality: number; prevQuality: number; note: string }
export interface PlannerDataset {
  asOf: string;
  union: { id: string; name: string };
  products: ProductRow[];
  dates: string[];
  temps: Record<City, number[]>;
  units: Record<string, Record<Channel, number[]>>; // key `${city}|${product}`
  events: { name: string; kind: 'festival' | 'heatwave'; from: string; to: string; effects: Record<string, number> }[];
  sources: SourceRow[];
  supply: { month: string; buffalo: number; cow: number; marketShare: number }[];
  baseline: Record<string, number>;
  societies: SocietyLite[];
  zones: ZoneRow[];
}
export interface PlannerWorkflow { program: ProgramView | null; audit: AuditEvent[]; acceptedPlans: { month: string; kind: 'recommended' | 'adjusted'; acceptedBy: string }[] }

export interface LenderCaseRow { id: string; ref: string; farmer: string; product: string; amount: number; status: AppStatus; updated: string; background: boolean; submitted: string | null; consent: 'active' | 'withdrawn' | 'none'; dossierGenerated: boolean }
export interface LenderData { lender: { id: string; name: string }; cases: LenderCaseRow[]; products: LoanProduct[]; audit: AuditEvent[] }
export interface LenderCase {
  application: Application;
  farmer: { name: string; code: string; society: string } | null;
  consent: Consent | null;
  kyc: KycRecord[] | null; property: PropertyRecord | null; credit: CreditRecord | null;
  income: { key: string; total: number; litres: number }[] | null;
  background: boolean;
  dossier?: LoanDossier;
}
// Everything the bank-ready loan PDF needs, read from existing records only (never invented).
// null means "Not provided": either not in Amul Setu or not covered by the farmer's consent.
export interface LoanDossier {
  asOf: string;
  lenderName: string;
  applicant: { name: string | null; code: string | null; dob: string | null; gender: string | null; mobile: string | null; mobileVerified: boolean | null };
  address: { village: string | null; taluka: string | null; district: string | null; state: string | null; pincode: string | null } | null;
  cooperative: { society: string | null; societyCode: string | null; union: string | null; memberSince: string | null };
  cattle: { buffalo: number; cow: number; estimatedDailyYield: number } | null;
  submittedAt: string | null;
  consentStatements: string[] | null; // the statements the farmer confirmed in the app, for the recorded notice version
  generatedCount: number; // dossier PDFs generated earlier for this application (audit trail)
}

export interface DemoState { incentive: string; farmerInterested: boolean; application: string; openQueries: number; db: 'postgres' | 'pglite' }
