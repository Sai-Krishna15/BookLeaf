import { RouterProvider } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { AuthProvider } from './providers/AuthProvider';
import { SocketProvider } from './providers/SocketProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="bookleaf_theme">
      <QueryProvider>
        <AuthProvider>
          <SocketProvider>
            <TooltipProvider delayDuration={300}>
              <RouterProvider router={router} />
              <Toaster richColors closeButton position="bottom-right" />
            </TooltipProvider>
          </SocketProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
export default App;
