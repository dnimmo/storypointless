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

/**
 * For participant-attributed actions, the client also sends its own
 * participantId. The server verifies it matches the connection's binding
 * before applying the action — a sanity check to prevent silent
 * misattribution if client and server identity drift apart.
 */
export type ClientEvent =
  | { type: 'create_room'; name: string; scale?: ScaleId; threshold?: number; anonymous?: boolean }
  | { type: 'join_room'; code: string; name: string }
  | { type: 'cast_vote'; cardIndex: number; participantId?: string }
  | { type: 'clear_vote'; participantId?: string }
  | { type: 'reveal'; participantId?: string }
  | { type: 'next_round'; participantId?: string }
  | { type: 'set_anonymous'; anonymous: boolean; participantId?: string }
  | { type: 'set_threshold'; threshold: number; participantId?: string };

export type ServerEvent =
  | { type: 'welcome'; participantId: string; room: RoomView }
  | { type: 'room_state'; room: RoomView }
  | { type: 'error'; message: string };
