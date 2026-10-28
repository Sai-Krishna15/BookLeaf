import type { PaginationMeta } from '@/components/common/Pagination';

export type BookStatus = 'PUBLISHED' | 'IN_PRODUCTION';

export type ProductionStage =
  | 'MANUSCRIPT'
  | 'EDITING'
  | 'COVER_DESIGN'
  | 'TYPESETTING'
  | 'PROOFREADING'
  | 'ISBN'
  | 'PRINTING'
  | 'DISTRIBUTION'
  | 'LIVE';

export interface StageProgress {
  stage: ProductionStage;
  label: string;
  step: number;
  totalSteps: number;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface PayoutWindows {
  currentQuarter: string;
  nextPayoutDate: string;
  estimatedWindow: string;
}

export interface Book {
  id: string;
  authorId: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  status: BookStatus;
  publicationDate: string | null;
  mrp: number | null;
  copiesSold: number;
  royaltyPerCopy: number | null;
  totalRoyaltyEarned: number;
  totalRoyaltyPaid: number;
  totalRoyaltyPending: number;
  lastPayoutDate: string | null;
  printPartner: string | null;
  distributionPlatforms: string[];
  currentProductionStage: ProductionStage | null;
  isInProduction: boolean;
  stageProgress: StageProgress[] | null;
  payoutWindows: PayoutWindows | null;
  neverPaid: boolean;
  belowPayoutThreshold: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BooksSummary {
  totalBooks: number;
  publishedBooks: number;
  inProductionBooks: number;
  totalCopiesSold: number;
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  belowPayoutThreshold: boolean;
}

export interface BookListResponse {
  items: Book[];
  meta: PaginationMeta;
}
