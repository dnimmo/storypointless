import { describe, expect, it } from 'vitest';
import {
  addParticipant,
  castVote,
  createRoom,
  nextRound,
  reveal,
} from './room.ts';

function setupRoom() {
  const room = createRoom({
    code: 'ABCD',
    scale: 'fibonacci',
    threshold: 2,
    anonymous: false,
  });
  const host = addParticipant(room, 'Host', 'conn-host');
  room.hostId = host.id;
  const guest = addParticipant(room, 'Guest', 'conn-guest');
  return { room, host, guest };
}

describe('reveal', () => {
  it('only allows the host to reveal', () => {
    const { room, host, guest } = setupRoom();
    castVote(room, host.id, 1);
    castVote(room, guest.id, 4);

    expect(reveal(room, guest.id)).toBe(false);
    expect(room.phase).toBe('voting');
    expect(room.reveal).toBeNull();

    expect(reveal(room, host.id)).toBe(true);
    expect(room.phase).toBe('revealed');
    expect(room.reveal).not.toBeNull();
  });

  it('reveals the empty state when no one has voted yet', () => {
    const { room, host } = setupRoom();
    expect(reveal(room, host.id)).toBe(true);
    expect(room.phase).toBe('revealed');
    expect(room.reveal?.voterCount).toBe(0);
  });

  it('refuses to reveal when not in voting phase', () => {
    const { room, host, guest } = setupRoom();
    castVote(room, host.id, 1);
    castVote(room, guest.id, 4);
    reveal(room, host.id);
    // already revealed, second reveal should be a no-op
    expect(reveal(room, host.id)).toBe(false);
  });
});

describe('nextRound', () => {
  it('only allows the host to start a new round', () => {
    const { room, host, guest } = setupRoom();
    castVote(room, host.id, 1);
    reveal(room, host.id);

    expect(nextRound(room, guest.id)).toBe(false);
    expect(room.phase).toBe('revealed');

    expect(nextRound(room, host.id)).toBe(true);
    expect(room.phase).toBe('voting');
    expect(room.reveal).toBeNull();
    expect(room.votes.size).toBe(0);
  });

  it('refuses when not in revealed phase', () => {
    const { room, host } = setupRoom();
    expect(nextRound(room, host.id)).toBe(false);
    expect(room.phase).toBe('voting');
  });
});

describe('createRoom', () => {
  it('starts a new room directly in the voting phase, no setup step needed', () => {
    const { room } = setupRoom();
    expect(room.phase).toBe('voting');
  });
});
