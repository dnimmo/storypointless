import { randomUUID } from 'node:crypto';
import {
  computeDisagreements,
  getScale,
  type RevealResult,
  type RoomView,
  type ScaleId,
} from '@storypointless/shared';

export type Participant = {
  id: string;
  name: string;
  connectionId: string;
};

export type Room = {
  code: string;
  hostId: string;
  scale: ScaleId;
  threshold: number;
  anonymous: boolean;
  participants: Map<string, Participant>;
  phase: 'voting' | 'revealed';
  votes: Map<string, number>;
  reveal: RevealResult | null;
  createdAt: number;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function createRoom(opts: {
  code: string;
  scale: ScaleId;
  threshold: number;
  anonymous: boolean;
}): Room {
  return {
    code: opts.code,
    hostId: '',
    scale: opts.scale,
    threshold: opts.threshold,
    anonymous: opts.anonymous,
    participants: new Map(),
    phase: 'voting',
    votes: new Map(),
    reveal: null,
    createdAt: Date.now(),
  };
}

export function addParticipant(room: Room, name: string, connectionId: string): Participant {
  const participant: Participant = { id: randomUUID(), name, connectionId };
  room.participants.set(participant.id, participant);
  return participant;
}

export function removeParticipant(room: Room, participantId: string): void {
  room.participants.delete(participantId);
  room.votes.delete(participantId);
}

export function castVote(room: Room, participantId: string, cardIndex: number): void {
  if (room.phase !== 'voting') return;
  if (!room.participants.has(participantId)) return;
  const scale = getScale(room.scale);
  if (cardIndex < 0 || cardIndex >= scale.cards.length) return;
  room.votes.set(participantId, cardIndex);
}

export function clearVote(room: Room, participantId: string): void {
  if (room.phase !== 'voting') return;
  room.votes.delete(participantId);
}

export function reveal(room: Room, requesterId: string): boolean {
  if (requesterId !== room.hostId) return false;
  if (room.phase !== 'voting') return false;
  const scale = getScale(room.scale);
  const rawVotes = Array.from(room.votes.entries()).map(([participantId, cardIndex]) => ({
    participantId,
    cardIndex,
  }));
  const result = computeDisagreements(rawVotes, scale, room.threshold);
  room.reveal = {
    significantPairs: result.significantPairs,
    abstainerIds: result.abstainerIds,
    voterCount: result.voterCount,
    broadAgreement: result.broadAgreement,
  };
  room.phase = 'revealed';
  return true;
}

export function nextRound(room: Room, requesterId: string): boolean {
  if (requesterId !== room.hostId) return false;
  if (room.phase !== 'revealed') return false;
  room.phase = 'voting';
  room.votes.clear();
  room.reveal = null;
  return true;
}

export function setAnonymous(room: Room, anonymous: boolean): void {
  room.anonymous = anonymous;
}

export function setThreshold(room: Room, threshold: number): void {
  if (!Number.isFinite(threshold) || threshold < 1) return;
  room.threshold = Math.floor(threshold);
}

export function toRoomView(room: Room): RoomView {
  return {
    code: room.code,
    scale: room.scale,
    threshold: room.threshold,
    anonymous: room.anonymous,
    participants: Array.from(room.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId,
    })),
    phase: room.phase,
    votedParticipantIds: Array.from(room.votes.keys()),
    reveal: room.reveal,
  };
}
