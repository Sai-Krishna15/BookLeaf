import * as React from 'react';
import { toast } from 'sonner';
import { AppSocket, createSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useAuth } from '@/features/auth/useAuth';
import { queryClient } from './QueryProvider';

export type SocketStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

interface SocketContextValue {
  socket: AppSocket | null;
  status: SocketStatus;
}

const SocketContext = React.createContext<SocketContextValue>({
  socket: null,
  status: 'disconnected',
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const [status, setStatus] = React.useState<SocketStatus>('disconnected');
  const [socket, setSocket] = React.useState<AppSocket | null>(null);

  React.useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');
    const s = createSocket(token);
    setSocket(s);

    const onConnect = () => {
      setStatus('connected');
    };

    const onDisconnect = () => {
      setStatus('disconnected');
    };

    const onConnectError = () => {
      setStatus('reconnecting');
    };

    const onReconnect = () => {
      setStatus('connected');
      // On reconnect, invalidate all queries to pull fresh server state
      queryClient.invalidateQueries();
    };

    const onAuthExpired = (payload: { message?: string }) => {
      toast.error(payload?.message || 'Session expired. Please log in again.');
      logout();
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    // Socket.IO io manager events
    s.io.on('reconnect', onReconnect);
    s.on('auth:expired' as never, onAuthExpired as never);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.io.off('reconnect', onReconnect);
      s.off('auth:expired' as never, onAuthExpired as never);
      disconnectSocket();
    };
  }, [token, logout]);

  const value = React.useMemo(() => ({ socket, status }), [socket, status]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  const context = React.useContext(SocketContext);
  if (!context) {
    return { socket: getSocket(), status: 'disconnected' };
  }
  return context;
}
