import type { APIGatewayProxyHandler } from 'aws-lambda';
import type { ClientEvent, ServerEvent } from '@storypointless/shared';
import { gatewayClientFor, broadcastRoomState, sendTo } from '../broadcast.ts';
import {
  addParticipant,
  castVote,
  clearVote,
  createRoom,
  generateRoomCode,
  nextRound,
  reveal,
  setAnonymous,
  setThreshold,
  toRoomView,
} from '../room.ts';
import {
  deleteRoom,
  loadRoom,
  lookupConnection,
  saveRoom,
  trackConnection,
} from '../store.ts';

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId!;
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const client = gatewayClientFor({ endpoint });

  let body: ClientEvent;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    await sendTo(client, connectionId, { type: 'error', message: 'Malformed message' });
    return { statusCode: 400, body: '' };
  }

  // create_room and join_room don't need an existing connection record.
  if (body.type === 'create_room') {
    const name = (body.name || '').trim();
    if (!name) {
      await sendTo(client, connectionId, { type: 'error', message: 'Name is required' });
      return { statusCode: 200, body: '' };
    }

    let code = generateRoomCode();
    // Tiny chance of collision; retry a few times.
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await loadRoom(code);
      if (!existing) break;
      code = generateRoomCode();
    }

    const room = createRoom({
      code,
      scale: body.scale ?? 'fibonacci',
      threshold: body.threshold ?? 2,
      anonymous: body.anonymous ?? false,
    });
    const participant = addParticipant(room, name, connectionId);
    room.hostId = participant.id;
    await saveRoom(room);
    await trackConnection(connectionId, room.code, participant.id);
    await sendTo(client, connectionId, {
      type: 'welcome',
      participantId: participant.id,
      room: toRoomView(room),
    });
    return { statusCode: 200, body: '' };
  }

  if (body.type === 'join_room') {
    const name = (body.name || '').trim();
    if (!name) {
      await sendTo(client, connectionId, { type: 'error', message: 'Name is required' });
      return { statusCode: 200, body: '' };
    }
    const room = await loadRoom(body.code);
    if (!room) {
      await sendTo(client, connectionId, { type: 'error', message: 'Room not found' });
      return { statusCode: 200, body: '' };
    }
    const participant = addParticipant(room, name, connectionId);
    await saveRoom(room);
    await trackConnection(connectionId, room.code, participant.id);
    await sendTo(client, connectionId, {
      type: 'welcome',
      participantId: participant.id,
      room: toRoomView(room),
    });
    await broadcastRoomState(client, room);
    return { statusCode: 200, body: '' };
  }

  // Everything else requires an existing connection ↔ participant binding.
  const lookup = await lookupConnection(connectionId);
  if (!lookup) {
    await sendTo(client, connectionId, {
      type: 'error',
      message: 'Not in a room. Send create_room or join_room first.',
    });
    return { statusCode: 200, body: '' };
  }
  const room = await loadRoom(lookup.roomCode);
  if (!room) {
    await sendTo(client, connectionId, { type: 'error', message: 'Room is gone' });
    return { statusCode: 200, body: '' };
  }
  const participantId = lookup.participantId;

  switch (body.type) {
    case 'cast_vote':
      castVote(room, participantId, body.cardIndex);
      break;
    case 'clear_vote':
      clearVote(room, participantId);
      break;
    case 'reveal': {
      const ok = reveal(room, participantId);
      if (!ok && participantId !== room.hostId) {
        await sendTo(client, connectionId, {
          type: 'error',
          message: 'Only the host can reveal',
        });
        return { statusCode: 200, body: '' };
      }
      break;
    }
    case 'next_round': {
      const ok = nextRound(room, participantId);
      if (!ok && participantId !== room.hostId) {
        await sendTo(client, connectionId, {
          type: 'error',
          message: 'Only the host can start the next round',
        });
        return { statusCode: 200, body: '' };
      }
      break;
    }
    case 'set_anonymous':
      setAnonymous(room, body.anonymous);
      break;
    case 'set_threshold':
      setThreshold(room, body.threshold);
      break;
  }

  await saveRoom(room);
  const goneIds = await broadcastRoomState(client, room);

  if (goneIds.length > 0) {
    // Async cleanup of zombies that didn't respond to postToConnection.
    for (const id of goneIds) room.participants.delete(id);
    if (room.participants.size === 0) {
      await deleteRoom(room.code);
    } else {
      await saveRoom(room);
    }
  }

  return { statusCode: 200, body: '' };
};
