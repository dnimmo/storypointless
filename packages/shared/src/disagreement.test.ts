import { describe, expect, it } from 'vitest';
import { computeDisagreements } from './disagreement.ts';
import { SCALES } from './scales.ts';

const fib = SCALES.fibonacci;

describe('computeDisagreements', () => {
  it('emits no pairs and no broad-agreement signal when nobody votes', () => {
    const r = computeDisagreements([], fib, 2);
    expect(r.significantPairs).toEqual([]);
    expect(r.broadAgreement).toBe(false);
    expect(r.voterCount).toBe(0);
    expect(r.abstainerIds).toEqual([]);
  });

  it('does not signal broad agreement with a single voter', () => {
    const r = computeDisagreements([{ participantId: 'a', cardIndex: 2 }], fib, 2);
    expect(r.broadAgreement).toBe(false);
    expect(r.voterCount).toBe(1);
    expect(r.significantPairs).toEqual([]);
  });

  it('signals broad agreement when every pair is within the threshold', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 2 },
        { participantId: 'b', cardIndex: 3 },
        { participantId: 'c', cardIndex: 2 },
      ],
      fib,
      2,
    );
    expect(r.significantPairs).toEqual([]);
    expect(r.broadAgreement).toBe(true);
    expect(r.voterCount).toBe(3);
  });

  it('emits a pair when two voters meet the threshold exactly', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 1 },
        { participantId: 'b', cardIndex: 3 },
      ],
      fib,
      2,
    );
    expect(r.significantPairs).toEqual([{ a: 'a', b: 'b' }]);
    expect(r.broadAgreement).toBe(false);
  });

  it('does not emit a pair below the threshold', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 1 },
        { participantId: 'b', cardIndex: 2 },
      ],
      fib,
      2,
    );
    expect(r.significantPairs).toEqual([]);
    expect(r.broadAgreement).toBe(true);
  });

  it('returns every pair that exceeds the threshold', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 0 },
        { participantId: 'b', cardIndex: 3 },
        { participantId: 'c', cardIndex: 5 },
      ],
      fib,
      2,
    );
    expect(r.significantPairs).toHaveLength(3);
    expect(r.broadAgreement).toBe(false);
  });

  it('separates abstainers from the disagreement calculation', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 0 },
        { participantId: 'b', cardIndex: 4 },
        { participantId: 'c', cardIndex: fib.abstainIndex },
      ],
      fib,
      2,
    );
    expect(r.significantPairs).toEqual([{ a: 'a', b: 'b' }]);
    expect(r.abstainerIds).toEqual(['c']);
    expect(r.voterCount).toBe(2);
  });

  it('reports voterCount = 0 when everyone abstains', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: fib.abstainIndex },
        { participantId: 'b', cardIndex: fib.abstainIndex },
      ],
      fib,
      2,
    );
    expect(r.voterCount).toBe(0);
    expect(r.abstainerIds).toEqual(['a', 'b']);
    expect(r.significantPairs).toEqual([]);
    expect(r.broadAgreement).toBe(false);
  });

  it('respects a custom threshold', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 0 },
        { participantId: 'b', cardIndex: 1 },
      ],
      fib,
      1,
    );
    expect(r.significantPairs).toEqual([{ a: 'a', b: 'b' }]);
  });

  it('never returns numeric distance information (philosophy invariant)', () => {
    const r = computeDisagreements(
      [
        { participantId: 'a', cardIndex: 0 },
        { participantId: 'b', cardIndex: 6 },
      ],
      fib,
      2,
    );
    // The result must surface only participant ids and boolean signals,
    // never anything that hints at how big the gap was.
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/distance|gap|severity|magnitude|score/i);
    for (const pair of r.significantPairs) {
      expect(Object.keys(pair).sort()).toEqual(['a', 'b']);
    }
  });
});
