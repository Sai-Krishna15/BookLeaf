import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, KeyRound, Loader2, Mail, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { authApi } from './auth.api';
import { useAuth } from './useAuth';
import { ApiError } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  {
    label: 'Priya (Author)',
    email: 'priya.sharma@email.com',
    password: 'Test@1234',
    badge: 'Author',
  },
  {
    label: 'Ananya (Author)',
    email: 'ananya.reddy@email.com',
    password: 'Test@1234',
    badge: 'Author',
  },
  {
    label: 'Admin (Staff)',
    email: 'admin@bookleaf.com',
    password: 'Admin@1234',
    badge: 'Admin',
  },
];

export function LoginPage() {
  const { setAuth, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const showDemoCredentials =
    import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === 'true' ||
    import.meta.env.VITE_SHOW_DEMO_CREDENTIALS === true ||
    import.meta.env.DEV;

  React.useEffect(() => {
    if (isAuthenticated && user) {
      const defaultPath = user.role === 'ADMIN' ? '/admin/tickets' : '/books';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fromPath = (location.state as any)?.from?.pathname;
      const isPrivateTicketDetail = fromPath && /^\/tickets\/[^\/]+$/.test(fromPath) && fromPath !== '/tickets/new';
      const target = fromPath && !isPrivateTicketDetail ? fromPath : defaultPath;
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const onSubmit = async (values: LoginFormValues) => {
    setErrorMessage(null);
    try {
      const res = await authApi.login(values);
      // Temporarily write token so getMe request interceptor has it
      sessionStorage.setItem('bookleaf_token', res.token);
      let authorProfile = null;
      try {
        const me = await authApi.getMe();
        authorProfile = me.author;
      } catch {
        // Fallback if me fetch fails
      }

      setAuth(res.token, res.user, authorProfile);
      const fromPath = (location.state as any)?.from?.pathname;
      const isPrivateTicketDetail = fromPath && /^\/tickets\/[^\/]+$/.test(fromPath) && fromPath !== '/tickets/new';
      const defaultPath = res.user.role === 'ADMIN' ? '/admin/tickets' : '/books';
      const target = fromPath && !isPrivateTicketDetail ? fromPath : defaultPath;
      navigate(target, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to sign in. Please verify your credentials.');
      }
    }
  };

  const fillDemo = (email: string, pass: string) => {
    form.setValue('email', email, { shouldValidate: true });
    form.setValue('password', pass, { shouldValidate: true });
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">BookLeaf Portal</h1>
          <p className="text-sm text-muted-foreground">
            Author support, royalty management & ticket triage
          </p>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-semibold">Sign In</CardTitle>
            <CardDescription>Enter your account credentials to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20"
              >
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            placeholder="author@example.com"
                            className="pl-9"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="pl-9"
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full mt-2 font-medium"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>

          {showDemoCredentials && (
            <CardFooter className="flex flex-col items-start border-t border-border pt-4 bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Demo Credentials (Click to fill)
              </span>
              <div className="flex flex-wrap gap-2 w-full">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email, acc.password)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
                  >
                    <span className="font-medium">{acc.label}</span>
                  </button>
                ))}
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
export default LoginPage;
