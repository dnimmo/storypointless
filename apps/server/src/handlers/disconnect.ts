import type { APIGatewayProxyHandler } from 'aws-lambda';
import { gatewayClientFor, broadcastRoomState } from '../broadcast.ts';
import { removeParticipant } from '../room.ts';
import {
  deleteRoom,
  forgetConnection,
  loadRoom,
  lookupConnection,
  saveRoom,
} from '../store.ts';

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId!;
  const lookup = await lookupConnection(connectionId);
  await forgetConnection(connectionId);
  if (!lookup) return { statusCode: 200, body: '' };

  const room = await loadRoom(lookup.roomCode);
  if (!room) return { statusCode: 200, body: '' };

  removeParticipant(room, lookup.participantId);

  // If the host left, hand the host role to the next remaining participant.
  // If the room is empty, drop it entirely.
  if (room.participants.size === 0) {
    await deleteRoom(room.code);
    return { statusCode: 200, body: '' };
  }
  if (room.hostId === lookup.participantId) {
    const next = room.participants.values().next().value;
    if (next) room.hostId = next.id;
  }

  await saveRoom(room);

  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const client = gatewayClientFor({ endpoint });
  await broadcastRoomState(client, room);

  return { statusCode: 200, body: '' };
};
