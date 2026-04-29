import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { Room, Participant } from './room.ts';
import type { ScaleId } from '@storypointless/shared';

const TABLE_NAME = process.env.TABLE_NAME ?? '';
const ROOM_TTL_SECONDS = 60 * 60 * 24; // 24 hours from last write

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

type RoomRecord = {
  pk: string;
  sk: string;
  code: string;
  hostId: string;
  scale: ScaleId;
  threshold: number;
  anonymous: boolean;
  participants: Participant[];
  phase: Room['phase'];
  votes: { participantId: string; cardIndex: number }[];
  reveal: Room['reveal'];
  createdAt: number;
  expiresAt: number;
};

type ConnectionRecord = {
  pk: string;
  sk: string;
  connectionId: string;
  roomCode: string;
  participantId: string;
  expiresAt: number;
};

function roomPk(code: string): string {
  return `ROOM#${code.toUpperCase()}`;
}

function connPk(connectionId: string): string {
  return `CONN#${connectionId}`;
}

function roomToRecord(room: Room): RoomRecord {
  return {
    pk: roomPk(room.code),
    sk: 'META',
    code: room.code,
    hostId: room.hostId,
    scale: room.scale,
    threshold: room.threshold,
    anonymous: room.anonymous,
    participants: Array.from(room.participants.values()),
    phase: room.phase,
    votes: Array.from(room.votes.entries()).map(([participantId, cardIndex]) => ({
      participantId,
      cardIndex,
    })),
    reveal: room.reveal,
    createdAt: room.createdAt,
    expiresAt: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
  };
}

function recordToRoom(rec: RoomRecord): Room {
  const participants = new Map<string, Participant>();
  for (const p of rec.participants) participants.set(p.id, p);
  const votes = new Map<string, number>();
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
    createdAt: rec.createdAt,
  };
}

export async function loadRoom(code: string): Promise<Room | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: roomPk(code), sk: 'META' },
    }),
  );
  if (!result.Item) return null;
  return recordToRoom(result.Item as RoomRecord);
}

export async function saveRoom(room: Room): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: roomToRecord(room),
    }),
  );
}

export async function deleteRoom(code: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: roomPk(code), sk: 'META' },
    }),
  );
}

export async function trackConnection(
  connectionId: string,
  roomCode: string,
  participantId: string,
): Promise<void> {
  const rec: ConnectionRecord = {
    pk: connPk(connectionId),
    sk: 'META',
    connectionId,
    roomCode,
    participantId,
    expiresAt: Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
  };
  await ddb.send(new PutCommand({ TableName: TABLE_NAME, Item: rec }));
}

export async function lookupConnection(
  connectionId: string,
): Promise<{ roomCode: string; participantId: string } | null> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: connPk(connectionId), sk: 'META' },
    }),
  );
  if (!result.Item) return null;
  const rec = result.Item as ConnectionRecord;
  return { roomCode: rec.roomCode, participantId: rec.participantId };
}

export async function forgetConnection(connectionId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { pk: connPk(connectionId), sk: 'META' },
    }),
  );
}
