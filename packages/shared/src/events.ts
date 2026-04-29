import type { ScaleId } from './scales.ts';

export type Phase = 'voting' | 'revealed';

export type ParticipantView = {
  id: string;
  name: string;
  isHost: boolean;
};

export type RoomView = {
  code: string;
  scale: ScaleId;
  threshold: number;
  anonymous: boolean;
  participants: ParticipantView[];
  phase: Phase;
  votedParticipantIds: string[];
  reveal: RevealResult | null;
};

export type RevealResult = {
  significantPairs: { a: string; b: string }[];
  abstainerIds: string[];
  voterCount: number;
  broadAgreement: boolean;
};

export type ClientEvent =
  | { type: 'create_room'; name: string; scale?: ScaleId; threshold?: number; anonymous?: boolean }
  | { type: 'join_room'; code: string; name: string }
  | { type: 'cast_vote'; cardIndex: number }
  | { type: 'clear_vote' }
  | { type: 'reveal' }
  | { type: 'next_round' }
  | { type: 'set_anonymous'; anonymous: boolean }
  | { type: 'set_threshold'; threshold: number };

export type ServerEvent =
  | { type: 'welcome'; participantId: string; room: RoomView }
  | { type: 'room_state'; room: RoomView }
  | { type: 'error'; message: string };
