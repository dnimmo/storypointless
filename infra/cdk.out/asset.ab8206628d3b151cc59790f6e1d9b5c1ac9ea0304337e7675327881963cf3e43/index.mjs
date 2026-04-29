import { createRequire } from 'module'; const require = createRequire(import.meta.url);

// apps/server/src/broadcast.ts
import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} from "@aws-sdk/client-apigatewaymanagementapi";

// apps/server/src/room.ts
import { randomUUID } from "node:crypto";

// packages/shared/src/scales.ts
var SCALES = {
  fibonacci: {
    id: "fibonacci",
    name: "Fibonacci",
    cards: ["1", "2", "3", "5", "8", "13", "21", "?"],
    abstainIndex: 7
  },
  tshirt: {
    id: "tshirt",
    name: "T-shirt",
    cards: ["XS", "S", "M", "L", "XL", "?"],
    abstainIndex: 5
  }
};
function getScale(id) {
  return SCALES[id];
}

// packages/shared/src/disagreement.ts
function computeDisagreements(votes, scale, threshold) {
  const abstainerIds = [];
  const cast = [];
  for (const vote of votes) {
    if (vote.cardIndex === scale.abstainIndex) {
      abstainerIds.push(vote.participantId);
    } else {
      cast.push(vote);
    }
  }
  const pairs = [];
  for (let i = 0; i < cast.length; i++) {
    for (let j = i + 1; j < cast.length; j++) {
      const left = cast[i];
      const right = cast[j];
      if (Math.abs(left.cardIndex - right.cardIndex) >= threshold) {
        pairs.push({ a: left.participantId, b: right.participantId });
      }
    }
  }
  return {
    significantPairs: pairs,
    abstainerIds,
    voterCount: cast.length,
    broadAgreement: pairs.length === 0 && cast.length > 1
  };
}

// apps/server/src/room.ts
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
function generateRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}
function createRoom(opts) {
  return {
    code: opts.code,
    hostId: "",
    scale: opts.scale,
    threshold: opts.threshold,
    anonymous: opts.anonymous,
    participants: /* @__PURE__ */ new Map(),
    phase: "voting",
    votes: /* @__PURE__ */ new Map(),
    reveal: null,
    createdAt: Date.now()
  };
}
function addParticipant(room, name, connectionId) {
  const participant = { id: randomUUID(), name, connectionId };
  room.participants.set(participant.id, participant);
  return participant;
}
function castVote(room, participantId, cardIndex) {
  if (room.phase !== "voting") return;
  if (!room.participants.has(participantId)) return;
  const scale = getScale(room.scale);
  if (cardIndex < 0 || cardIndex >= scale.cards.length) return;
  room.votes.set(participantId, cardIndex);
}
function clearVote(room, participantId) {
  if (room.phase !== "voting") return;
  room.votes.delete(participantId);
}
function reveal(room, requesterId) {
  if (requesterId !== room.hostId) return false;
  if (room.phase !== "voting") return false;
  const scale = getScale(room.scale);
  const rawVotes = Array.from(room.votes.entries()).map(([participantId, cardIndex]) => ({
    participantId,
    cardIndex
  }));
  const result = computeDisagreements(rawVotes, scale, room.threshold);
  room.reveal = {
    significantPairs: result.significantPairs,
    abstainerIds: result.abstainerIds,
    voterCount: result.voterCount,
    broadAgreement: result.broadAgreement
  };
  room.phase = "revealed";
  return true;
}
function nextRound(room, requesterId) {
  if (requesterId !== room.hostId) return false;
  if (room.phase !== "revealed") return false;
  room.phase = "voting";
  room.votes.clear();
  room.reveal = null;
  return true;
}
function setAnonymous(room, anonymous) {
  room.anonymous = anonymous;
}
function setThreshold(room, threshold) {
  if (!Number.isFinite(threshold) || threshold < 1) return;
  room.threshold = Math.floor(threshold);
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
async function trackConnection(connectionId, roomCode, participantId) {
  const rec = {
    pk: connPk(connectionId),
    sk: "META",
    connectionId,
    roomCode,
    participantId,
    expiresAt: Math.floor(Date.now() / 1e3) + ROOM_TTL_SECONDS
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: rec }));
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

// apps/server/src/handlers/message.ts
var handler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
  const client = gatewayClientFor({ endpoint });
  let body;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    await sendTo(client, connectionId, { type: "error", message: "Malformed message" });
    return { statusCode: 400, body: "" };
  }
  if (body.type === "create_room") {
    const name = (body.name || "").trim();
    if (!name) {
      await sendTo(client, connectionId, { type: "error", message: "Name is required" });
      return { statusCode: 200, body: "" };
    }
    let code = generateRoomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await loadRoom(code);
      if (!existing) break;
      code = generateRoomCode();
    }
    const room2 = createRoom({
      code,
      scale: body.scale ?? "fibonacci",
      threshold: body.threshold ?? 2,
      anonymous: body.anonymous ?? false
    });
    const participant = addParticipant(room2, name, connectionId);
    room2.hostId = participant.id;
    await saveRoom(room2);
    await trackConnection(connectionId, room2.code, participant.id);
    await sendTo(client, connectionId, {
      type: "welcome",
      participantId: participant.id,
      room: toRoomView(room2)
    });
    return { statusCode: 200, body: "" };
  }
  if (body.type === "join_room") {
    const name = (body.name || "").trim();
    if (!name) {
      await sendTo(client, connectionId, { type: "error", message: "Name is required" });
      return { statusCode: 200, body: "" };
    }
    const room2 = await loadRoom(body.code);
    if (!room2) {
      await sendTo(client, connectionId, { type: "error", message: "Room not found" });
      return { statusCode: 200, body: "" };
    }
    const participant = addParticipant(room2, name, connectionId);
    await saveRoom(room2);
    await trackConnection(connectionId, room2.code, participant.id);
    await sendTo(client, connectionId, {
      type: "welcome",
      participantId: participant.id,
      room: toRoomView(room2)
    });
    await broadcastRoomState(client, room2);
    return { statusCode: 200, body: "" };
  }
  const lookup = await lookupConnection(connectionId);
  if (!lookup) {
    await sendTo(client, connectionId, {
      type: "error",
      message: "Not in a room. Send create_room or join_room first."
    });
    return { statusCode: 200, body: "" };
  }
  const room = await loadRoom(lookup.roomCode);
  if (!room) {
    await sendTo(client, connectionId, { type: "error", message: "Room is gone" });
    return { statusCode: 200, body: "" };
  }
  const participantId = lookup.participantId;
  switch (body.type) {
    case "cast_vote":
      castVote(room, participantId, body.cardIndex);
      break;
    case "clear_vote":
      clearVote(room, participantId);
      break;
    case "reveal": {
      const ok = reveal(room, participantId);
      if (!ok && participantId !== room.hostId) {
        await sendTo(client, connectionId, {
          type: "error",
          message: "Only the host can reveal"
        });
        return { statusCode: 200, body: "" };
      }
      break;
    }
    case "next_round": {
      const ok = nextRound(room, participantId);
      if (!ok && participantId !== room.hostId) {
        await sendTo(client, connectionId, {
          type: "error",
          message: "Only the host can start the next round"
        });
        return { statusCode: 200, body: "" };
      }
      break;
    }
    case "set_anonymous":
      setAnonymous(room, body.anonymous);
      break;
    case "set_threshold":
      setThreshold(room, body.threshold);
      break;
  }
  await saveRoom(room);
  const goneIds = await broadcastRoomState(client, room);
  if (goneIds.length > 0) {
    for (const id of goneIds) room.participants.delete(id);
    if (room.participants.size === 0) {
      await deleteRoom(room.code);
    } else {
      await saveRoom(room);
    }
  }
  return { statusCode: 200, body: "" };
};
export {
  handler
};
