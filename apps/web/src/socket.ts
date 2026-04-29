import type { ClientEvent, ServerEvent } from '@storypointless/shared';

export type SocketStatus = 'connecting' | 'open' | 'closed';

export type Socket = {
  send: (event: ClientEvent) => void;
  close: () => void;
};

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8787';

export function connect(handlers: {
  onEvent: (event: ServerEvent) => void;
  onStatus: (status: SocketStatus) => void;
}): Socket {
  let ws: WebSocket | null = null;
  let closedByUs = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const queue: ClientEvent[] = [];

  function open() {
    handlers.onStatus('connecting');
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => {
      handlers.onStatus('open');
      while (queue.length > 0) {
        const evt = queue.shift()!;
        ws?.send(JSON.stringify(evt));
      }
    });
    ws.addEventListener('message', (e) => {
      try {
        const parsed = JSON.parse(e.data) as ServerEvent;
        handlers.onEvent(parsed);
      } catch {
        // ignore malformed
      }
    });
    ws.addEventListener('close', () => {
      handlers.onStatus('closed');
      if (!closedByUs) {
        reconnectTimer = setTimeout(open, 1000);
      }
    });
    ws.addEventListener('error', () => {
      ws?.close();
    });
  }

  open();

  return {
    send(event) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      } else {
        queue.push(event);
      }
    },
    close() {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
