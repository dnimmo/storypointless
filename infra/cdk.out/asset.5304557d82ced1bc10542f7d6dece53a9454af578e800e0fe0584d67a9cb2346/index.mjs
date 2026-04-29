import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// apps/server/src/broadcast.ts
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";

// apps/server/src/room.ts
function removeParticipant(room, participantId) {
  room.participants.delete(participantId);
  room.votes.delete(participantId);
}
function toRoomView(room) {
  return {
    code: room.code,
    scale: room.scale,
    threshold: room.threshold,
    anonymous: room.anonymous,
    participants: Array.from(room.participants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.id === room.hostId
    })),
    phase: room.phase,
    votedParticipantIds: Array.from(room.votes.keys()),
    reveal: room.reveal
  };
}

// apps/server/src/broadcast.ts
function gatewayClientFor(ctx) {
  return new ApiGatewayManagementApiClient({ endpoint: ctx.endpoint });
}
async function sendTo(client, connectionId, event) {
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: new TextEncoder().encode(JSON.stringify(event))
      })
    );
    return { ok: true, gone: false };
  } catch (err) {
    const e = err;
    if (e?.$metadata?.httpStatusCode === 410 || e?.name === "GoneException") {
      return { ok: false, gone: true };
    }
    throw err;
  }
}
async function broadcastRoomState(client, room) {
  const event = { type: "room_state", room: toRoomView(room) };
  const goneIds = [];
  await Promise.all(
    Array.from(room.participants.values()).map(async (p) => {
      const result = await sendTo(client, p.connectionId, event);
      if (result.gone) goneIds.push(p.id);
    })
  );
  return goneIds;
}

// apps/server/src/store.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";
var TABLE_NAME = process.env.TABLE_NAME ?? "";
var ROOM_TTL_SECONDS = 60 * 60 * 24;
var ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
function roomPk(code) {
  return `ROOM#${code.toUpperCase()}`;
}
function connPk(connectionId) {
  return `CONN#${connectionId}`;
}
function roomToRecord(room) {
  return {
    pk: roomPk(room.code),
    sk: "META",
    code: room.code,
    hostId: room.hostId,
    scale: room.scale,
    threshold: room.threshold,
    anonymous: room.anonymous,
    participants: Array.from(room.participants.values()),
    phase: room.phase,
    votes: Array.from(room.votes.entries()).map(([participantId, cardIndex]) => ({
      participantId,
      cardIndex
    })),
    reveal: room.reveal,
    createdAt: room.createdAt,
    expiresAt: Math.floor(Date.now() / 1e3) + ROOM_TTL_SECONDS
  };
}
function recordToRoom(rec) {
  const participants = /* @__PURE__ */ new Map();
  for (const p of rec.participants) participants.set(p.id, p);
  const votes = /* @__PURE__ */ new Map();
  for (const v of rec.votes) votes.set(v.participantId, v.cardIndex);
  return {
    code: rec.code,
    hostId: rec.hostId,
    scale: rec.scale,
    threshold: rec.threshold,
    anonymous: rec.anonymous,
    participants,
    phase: rec.phase,
    votes,
    reveal: rec.reveal,
    createdAt: rec.createdAt
  };
}
async function loadRoom(code) {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: roomPk(code), sk: "META" }
    })
  );
  if (!result.Item) return null;
  return recordToRoom(result.Item);
}
async function saveRoom(room) {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: roomToRecord(room)
    })
  );
}
async function deleteRoom(code) {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: roomPk(code), sk: "META" }
    })
  );
}
async function lookupConnection(connectionId) {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: connPk(connectionId), sk: "META" }
    })
  );
  if (!result.Item) return null;
  const rec = result.Item;
  return { roomCode: rec.roomCode, participantId: rec.participantId };
}
async function forgetConnection(connectionId) {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: connPk(connectionId), sk: "META" }
    })
  );
}

// apps/server/src/handlers/disconnect.ts
var handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const lookup = await lookupConnection(connectionId);
  await forgetConnection(connectionId);
  if (!lookup) return { statusCode: 200, body: "" };
  const room = await loadRoom(lookup.roomCode);
  if (!room) return { statusCode: 200, body: "" };
  removeParticipant(room, lookup.participantId);
  if (room.participants.size === 0) {
    await deleteRoom(room.code);
    return { statusCode: 200, body: "" };
  }
  if (room.hostId === lookup.participantId) {
    const next = room.participants.values().next().value;
    if (next) room.hostId = next.id;
  }
  await saveRoom(room);
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const client = gatewayClientFor({ endpoint });
  await broadcastRoomState(client, room);
  return { statusCode: 200, body: "" };
};
export {
  handler
};
