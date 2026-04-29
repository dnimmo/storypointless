import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import type { ServerEvent } from '@storypointless/shared';
import { toRoomView, type Room } from './room.ts';

export type GatewayContext = {
  endpoint: string;
};

export function gatewayClientFor(ctx: GatewayContext): ApiGatewayManagementApiClient {
  return new ApiGatewayManagementApiClient({ endpoint: ctx.endpoint });
}

export async function sendTo(
  client: ApiGatewayManagementApiClient,
  connectionId: string,
  event: ServerEvent,
): Promise<{ ok: boolean; gone: boolean }> {
  try {
    await client.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: new TextEncoder().encode(JSON.stringify(event)),
      }),
    );
    return { ok: true, gone: false };
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e?.$metadata?.httpStatusCode === 410 || e?.name === 'GoneException') {
      return { ok: false, gone: true };
    }
    throw err;
  }
}

export async function broadcastRoomState(
  client: ApiGatewayManagementApiClient,
  room: Room,
): Promise<string[]> {
  const event: ServerEvent = { type: 'room_state', room: toRoomView(room) };
  const goneIds: string[] = [];
  await Promise.all(
    Array.from(room.participants.values()).map(async (p) => {
      const result = await sendTo(client, p.connectionId, event);
      if (result.gone) goneIds.push(p.id);
    }),
  );
  return goneIds;
}
