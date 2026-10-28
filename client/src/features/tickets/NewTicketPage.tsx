import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileDropzone } from '@/components/common/FileDropzone';
import { useBooks } from '@/features/books/hooks/useBooks';
import { useCreateTicket } from './hooks/useTickets';
import { ApiError } from '@/lib/api';
import type { AttachmentMeta } from './types';

const ticketSchema = z.object({
  bookId: z.string().nullable().optional(),
  subject: z
    .string()
    .trim()
    .min(5, 'Subject must be at least 5 characters')
    .max(150, 'Subject cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(5000, 'Description cannot exceed 5000 characters'),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

export function NewTicketPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBookId = searchParams.get('bookId');

  const { data: booksData, isLoading: booksLoading } = useBooks({ limit: 100 });
  const books = React.useMemo(() => booksData?.data || [], [booksData]);

  const createTicketMutation = useCreateTicket();
  const [attachments, setAttachments] = React.useState<AttachmentMeta[]>([]);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      bookId: preselectedBookId || 'general',
      subject: '',
      description: '',
    },
  });

  // Keep bookId synced when preselectedBookId arrives or books finish loading
  React.useEffect(() => {
    if (preselectedBookId && books.some((b) => b.id === preselectedBookId)) {
      form.setValue('bookId', preselectedBookId);
    }
  }, [preselectedBookId, books, form]);

  const subjectValue = form.watch('subject') || '';
  const descriptionValue = form.watch('description') || '';
  const isDirty = form.formState.isDirty || attachments.length > 0;

  // Accidental navigation guard (browser close/refresh)
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !form.formState.isSubmitSuccessful) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, form.formState.isSubmitSuccessful]);

  const onSubmit = async (values: TicketFormValues) => {
    setServerError(null);

    const payload = {
      bookId: values.bookId && values.bookId !== 'general' ? values.bookId : null,
      subject: values.subject.trim(),
      description: values.description.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    try {
      const created = await createTicketMutation.mutateAsync(payload);
      toast.success('Support query submitted successfully');
      navigate(`/tickets/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setServerError('You have submitted queries too quickly. Please wait a moment and try again.');
          return;
        }

        if (err.status === 400 && typeof err.details === 'object' && err.details !== null) {
          // Map backend field validation issues into form
          const details = err.details as Record<string, string>;
          if (details.subject) form.setError('subject', { message: details.subject });
          if (details.description) form.setError('description', { message: details.description });
          if (details.bookId) form.setError('bookId', { message: details.bookId });
          setServerError(err.message || 'Please correct the highlighted fields.');
          return;
        }

        if (err.status === 404) {
          setServerError('The selected book could not be found. Please select a valid book or general query.');
          return;
        }

        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard this query?')) {
        navigate('/tickets');
      }
    } else {
      navigate('/tickets');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Button>
      </div>

      <PageHeader
        title="Submit a Support Query"
        description="Describe your inquiry regarding royalties, ISBNs, printing, distribution, or production stages."
      />

      <Card className="shadow-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg">Query Details</CardTitle>
          <CardDescription>
            Our author support specialists typically respond within 24 to 48 business hours.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {serverError && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-lg bg-destructive/10 p-3.5 text-sm text-destructive border border-destructive/20"
            >
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to submit query</p>
                <p className="mt-0.5 text-xs opacity-90">{serverError}</p>
              </div>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Book Selection */}
              <FormField
                control={form.control}
                name="bookId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Book</FormLabel>
                    <Select
                      disabled={booksLoading}
                      onValueChange={field.onChange}
                      value={field.value || 'general'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a book or general inquiry" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">
                          <span className="font-medium">General / Account Level</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            (Account, global payout, general)
                          </span>
                        </SelectItem>
                        {books.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="font-medium truncate max-w-[280px]">{b.title}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({b.isPublished ? 'Published' : 'In Production'})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the specific title this query relates to, or General for account-wide questions.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subject */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Subject</FormLabel>
                      <span className="text-xs text-muted-foreground">
                        {subjectValue.length} / 150
                      </span>
                    </div>
                    <FormControl>
                      <Input
                        placeholder="e.g. Royalty payout clarification for Q1"
                        maxLength={150}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Summarize your inquiry in a concise title.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Description</FormLabel>
                      <span className="text-xs text-muted-foreground">
                        {descriptionValue.length} / 5000
                      </span>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="Provide details about your query. Include any relevant dates, order details, or questions..."
                        className="min-h-[160px] leading-relaxed resize-y"
                        maxLength={5000}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum 20 characters. Include clear specifics to help our team assist you quickly.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Attachments UI */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <FormLabel>Reference Attachments (Optional)</FormLabel>
                <FileDropzone files={attachments} onFilesChange={setAttachments} />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={createTicketMutation.isPending}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                  className="gap-2 min-w-[140px]"
                >
                  {createTicketMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Submit Query
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
export default NewTicketPage;
