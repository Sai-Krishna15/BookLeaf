import { useEffect, useRef } from 'react';
import { useSocket } from '@/app/providers/SocketProvider';
import type { ServerToClientEvents } from '@/lib/socket';

export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!socket) return;

    const listener = ((...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handlerRef.current as any)(...args);
    }) as unknown as ServerToClientEvents[K];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).on(event, listener);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off(event, listener);
    };
  }, [socket, event]);
}
