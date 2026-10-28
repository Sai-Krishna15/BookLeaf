import type { PaginationMeta } from '@/components/common/Pagination';

export interface StageProgress {
  stage: string;
  label: string;
  step: number;
  totalSteps: number;
  isComplete: boolean;
  isCurrent: boolean;
}

export interface PayoutWindows {
  lastQuarterEnd: string;
  lastQuarterPayoutDeadline: string;
  nextQuarterEnd: string;
  nextQuarterPayoutDeadline: string;
}

export interface Book {
  id: string;
  authorId: string;
  title: string;
  isbn: string; // shown exactly as stored, including XXXX placeholders
  genre: string;
  publicationDate: string | null; // YYYY-MM-DD
  status: string;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number | null;
  royaltyPaid: number | null;
  royaltyPending: number | null;
  lastRoyaltyPayoutDate: string | null; // YYYY-MM-DD
  printPartner: string | null;
  availableOn: string[];
  isPublished: boolean;
  productionStage: {
    currentStage: string | null;
    currentStageIndex: number | null;
    stages: StageProgress[];
  };
  neverPaid: boolean;
  belowPayoutThreshold: boolean;
  payoutWindows: PayoutWindows;
}

export interface BooksSummary {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  bookCount: number;
  publishedCount: number;
  inProductionCount: number;
  payoutThreshold: number;
  pendingBelowThreshold: boolean;
}

export interface BookListResponse {
  data: Book[];
  meta: PaginationMeta;
}
