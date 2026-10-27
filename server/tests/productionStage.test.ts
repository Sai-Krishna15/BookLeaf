import { describe, expect, it } from 'vitest';
import { STAGES, parseBookStatus } from '../src/common/productionStage';

describe('STAGES', () => {
  it('has the 9 KB stages in order', () => {
    expect([...STAGES]).toEqual([
      'Manuscript Received',
      'Editing',
      'Cover Design',
      'Typesetting',
      'Proofreading',
      'ISBN Assignment',
      'Printing',
      'Distribution Setup',
      'Published & Live',
    ]);
  });
});

describe('parseBookStatus', () => {
  it('"Published & Live": published, every stage complete', () => {
    const p = parseBookStatus('Published & Live');
    expect(p).toMatchObject({ isPublished: true, currentStage: 'Published & Live', currentStageIndex: 8 });
    expect(p.stages).toHaveLength(9);
    expect(p.stages.every((s) => s.state === 'complete')).toBe(true);
  });

  it('"In Production - Cover Design": Cover Design is current', () => {
    const p = parseBookStatus('In Production - Cover Design');
    expect(p).toMatchObject({ isPublished: false, currentStage: 'Cover Design', currentStageIndex: 2 });
    expect(p.stages.map((s) => s.state)).toEqual([
      'complete', 'complete', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
  });

  it('"In Production - Typesetting": Typesetting is current', () => {
    expect(parseBookStatus('In Production - Typesetting')).toMatchObject({
      currentStage: 'Typesetting',
      currentStageIndex: 3,
    });
  });

  it('every in-production stage name parses to its own index', () => {
    STAGES.slice(0, -1).forEach((name, i) => {
      expect(parseBookStatus(`In Production - ${name}`)).toMatchObject({ currentStage: name, currentStageIndex: i });
    });
  });

  it('is tolerant of case, spacing, dash style and short aliases', () => {
    expect(parseBookStatus('  in production \u2013 proofreading ').currentStage).toBe('Proofreading');
    expect(parseBookStatus('In Production-Printing').currentStage).toBe('Printing');
    expect(parseBookStatus('In Production - ISBN').currentStage).toBe('ISBN Assignment');
    expect(parseBookStatus('In Production - Distribution').currentStage).toBe('Distribution Setup');
    expect(parseBookStatus('published and live').isPublished).toBe(true);
  });

  it.each([
    ['Out of Print'],
    ['In Production - Quantum Binding'],
    ['In Production'],
    ['In Production - Published & Live'],
    [''],
    ['   '],
  ])('unknown status %j does not crash: stage null, raw status kept', (status) => {
    const p = parseBookStatus(status);
    expect(p.currentStage).toBeNull();
    expect(p.currentStageIndex).toBeNull();
    expect(p.isPublished).toBe(false);
    expect(p.rawStatus).toBe(status);
    expect(p.stages).toHaveLength(9);
    expect(p.stages.every((s) => s.state === 'upcoming')).toBe(true);
  });

  it('does not throw on non-string input', () => {
    expect(() => parseBookStatus(undefined as unknown as string)).not.toThrow();
    expect(() => parseBookStatus(null as unknown as string)).not.toThrow();
    expect(parseBookStatus(null as unknown as string).currentStage).toBeNull();
  });
});
