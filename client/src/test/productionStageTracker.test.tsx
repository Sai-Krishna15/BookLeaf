import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProductionStageTracker } from '@/components/common/ProductionStageTracker';
import type { StageProgress } from '@/features/books/types';

describe('ProductionStageTracker', () => {
  const mockStages: StageProgress[] = [
    { stage: 'MANUSCRIPT', label: 'Manuscript', step: 1, totalSteps: 9, isComplete: true, isCurrent: false },
    { stage: 'EDITING', label: 'Editing', step: 2, totalSteps: 9, isComplete: true, isCurrent: false },
    { stage: 'COVER_DESIGN', label: 'Cover Design', step: 3, totalSteps: 9, isComplete: false, isCurrent: true },
    { stage: 'TYPESETTING', label: 'Typesetting', step: 4, totalSteps: 9, isComplete: false, isCurrent: false },
    { stage: 'PROOFREADING', label: 'Proofreading', step: 5, totalSteps: 9, isComplete: false, isCurrent: false },
    { stage: 'ISBN', label: 'ISBN', step: 6, totalSteps: 9, isComplete: false, isCurrent: false },
    { stage: 'PRINTING', label: 'Printing', step: 7, totalSteps: 9, isComplete: false, isCurrent: false },
    { stage: 'DISTRIBUTION', label: 'Distribution', step: 8, totalSteps: 9, isComplete: false, isCurrent: false },
    { stage: 'LIVE', label: 'Live', step: 9, totalSteps: 9, isComplete: false, isCurrent: false },
  ];

  it('renders all 9 stage labels and current step indicator', () => {
    render(
      <ProductionStageTracker
        stages={mockStages}
        currentStage="COVER_DESIGN"
        currentStageIndex={2}
      />,
    );

    expect(screen.getByText(/Step 3 of 9: Cover Design/i)).toBeInTheDocument();
    expect(screen.getByText('Manuscript')).toBeInTheDocument();
    expect(screen.getByText('Cover Design')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('provides accessible sr-only text for each stage state', () => {
    render(<ProductionStageTracker stages={mockStages} />);

    expect(screen.getByText('Manuscript: Completed')).toBeInTheDocument();
    expect(screen.getByText('Cover Design: Current Step')).toBeInTheDocument();
    expect(screen.getByText('Live: Upcoming')).toBeInTheDocument();
  });

  it('gracefully renders raw status text when stages array is empty or unparseable', () => {
    render(
      <ProductionStageTracker
        stages={[]}
        currentStage={null}
        rawStatus="Custom Review Stage"
      />,
    );

    expect(screen.getByText('Custom Review Stage')).toBeInTheDocument();
    expect(
      screen.getByText(/Royalties begin once production stages conclude/i),
    ).toBeInTheDocument();
  });
});
