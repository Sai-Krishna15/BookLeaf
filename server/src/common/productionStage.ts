/** Production pipeline from the BookLeaf KB, in order. */
export const STAGES = [
  'Manuscript Received',
  'Editing',
  'Cover Design',
  'Typesetting',
  'Proofreading',
  'ISBN Assignment',
  'Printing',
  'Distribution Setup',
  'Published & Live',
] as const;

export type StageName = (typeof STAGES)[number];
export type StageState = 'complete' | 'current' | 'upcoming';

export interface StageProgress {
  name: StageName;
  state: StageState;
}

export interface ParsedBookStatus {
  /** The status string exactly as stored. */
  rawStatus: string;
  isPublished: boolean;
  /** null when the status is unknown/unparseable. */
  currentStage: StageName | null;
  currentStageIndex: number | null;
  stages: StageProgress[];
}

const PUBLISHED_INDEX = STAGES.length - 1;

const normalize = (s: string): string =>
  s.toLowerCase().replace(/\band\b/g, '&').replace(/\s+/g, ' ').trim();

/** normalized name -> stage index. Short aliases are accepted for the stages that have them. */
const STAGE_LOOKUP = new Map<string, number>([
  ...STAGES.map((name, i) => [normalize(name), i] as [string, number]),
  ['manuscript', 0],
  ['isbn', 5],
  ['distribution', 7],
]);

const IN_PRODUCTION = /^in production\s*[-\u2013\u2014:]\s*(.+)$/;

const buildStages = (state: (i: number) => StageState): StageProgress[] =>
  STAGES.map((name, i) => ({ name, state: state(i) }));

/**
 * "Published & Live"            -> every stage complete.
 * "In Production - Cover Design" -> Cover Design is current, earlier ones complete, later upcoming.
 * Anything else                  -> never throws: currentStage null, all stages upcoming, raw kept.
 */
export function parseBookStatus(status: string): ParsedBookStatus {
  const rawStatus = typeof status === 'string' ? status : String(status ?? '');
  const norm = normalize(rawStatus);

  if (norm === normalize('Published & Live')) {
    return {
      rawStatus,
      isPublished: true,
      currentStage: STAGES[PUBLISHED_INDEX] as StageName,
      currentStageIndex: PUBLISHED_INDEX,
      stages: buildStages(() => 'complete'),
    };
  }

  const stageText = IN_PRODUCTION.exec(norm)?.[1];
  const idx = stageText !== undefined ? STAGE_LOOKUP.get(stageText.trim()) : undefined;
  if (idx !== undefined && idx < PUBLISHED_INDEX) {
    return {
      rawStatus,
      isPublished: false,
      currentStage: STAGES[idx] as StageName,
      currentStageIndex: idx,
      stages: buildStages((i) => (i < idx ? 'complete' : i === idx ? 'current' : 'upcoming')),
    };
  }

  return {
    rawStatus,
    isPublished: false,
    currentStage: null,
    currentStageIndex: null,
    stages: buildStages(() => 'upcoming'),
  };
}
