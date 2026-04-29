import type { Scale } from './scales.ts';

export type RawVote = { participantId: string; cardIndex: number };

export type DisagreementResult = {
  significantPairs: { a: string; b: string }[];
  abstainerIds: string[];
  voterCount: number;
  broadAgreement: boolean;
};

/**
 * Compute pairwise disagreements between voters on an ordered scale.
 *
 * The output deliberately omits any numeric distance. It returns only the
 * participant IDs of pairs whose card-index gap meets or exceeds `threshold`.
 * Abstainers
 * (those who chose the scale's abstain card) are reported separately and
 * excluded from the pairwise comparison.
 */
export function computeDisagreements(
  votes: RawVote[],
  scale: Scale,
  threshold: number,
): DisagreementResult {
  const abstainerIds: string[] = [];
  const cast: RawVote[] = [];
  for (const vote of votes) {
    if (vote.cardIndex === scale.abstainIndex) {
      abstainerIds.push(vote.participantId);
    } else {
      cast.push(vote);
    }
  }

  const pairs: { a: string; b: string }[] = [];
  for (let i = 0; i < cast.length; i++) {
    for (let j = i + 1; j < cast.length; j++) {
      const left = cast[i]!;
      const right = cast[j]!;
      if (Math.abs(left.cardIndex - right.cardIndex) >= threshold) {
        pairs.push({ a: left.participantId, b: right.participantId });
      }
    }
  }

  return {
    significantPairs: pairs,
    abstainerIds,
    voterCount: cast.length,
    broadAgreement: pairs.length === 0 && cast.length > 1,
  };
}
