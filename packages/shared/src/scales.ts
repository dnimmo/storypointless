export type ScaleId = 'fibonacci' | 'tshirt';

export type Scale = {
  id: ScaleId;
  name: string;
  cards: readonly string[];
  abstainIndex: number;
};

export const SCALES: Record<ScaleId, Scale> = {
  fibonacci: {
    id: 'fibonacci',
    name: 'Fibonacci',
    cards: ['1', '2', '3', '5', '8', '13', '21', '?'],
    abstainIndex: 7,
  },
  tshirt: {
    id: 'tshirt',
    name: 'T-shirt',
    cards: ['XS', 'S', 'M', 'L', 'XL', '?'],
    abstainIndex: 5,
  },
};

export function getScale(id: ScaleId): Scale {
  return SCALES[id];
}
