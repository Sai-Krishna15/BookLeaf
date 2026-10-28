import * as React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Inbox, Menu, LogOut, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LiveIndicator } from '@/components/common/LiveIndicator';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useAuth } from '@/features/auth/useAuth';
import { useAdminTicketRealtime } from '@/features/admin/hooks/useAdminTicketRealtime';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { label: 'Ticket Queue', to: '/admin/tickets', icon: Inbox },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Mount admin realtime listener
  useAdminTicketRealtime();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true, state: null });
  };

  const getInitials = (name?: string) => {
    if (!name) return 'AD';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="space-y-1">
      {adminNavItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5 px-6 h-16 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-base leading-none text-foreground">BookLeaf</div>
            <div className="text-xs text-muted-foreground mt-0.5">Admin Ops Portal</div>
          </div>
        </div>

        <div className="flex-1 px-4 py-6">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground px-2">BookLeaf Staff Triage v1.0</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetHeader className="px-6 h-16 border-b border-border flex flex-row items-center gap-2.5 text-left">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <SheetTitle className="font-bold text-base leading-none">BookLeaf</SheetTitle>
                    <div className="text-xs text-muted-foreground mt-0.5">Admin Ops Portal</div>
                  </div>
                </SheetHeader>
                <div className="p-4">
                  <NavLinks onClick={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <span className="hidden sm:inline-block font-semibold text-sm text-foreground">
              Support Operations Queue
            </span>
          </div>

          <div className="flex items-center gap-3">
            <LiveIndicator />
            <ThemeToggle />

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 pl-2 pr-3 h-9 rounded-full hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="User menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                      {getInitials(user?.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline-block max-w-[120px] truncate">
                    {user?.name || 'Admin'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    <div className="pt-1">
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded">
                        Admin / Staff
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
