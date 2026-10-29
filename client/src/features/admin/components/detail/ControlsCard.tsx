import * as React from 'react';
import { UserCheck, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SourceMarker } from '../SourceMarker';
import { useAdmins, useAssignMe, usePatchTicket } from '../../hooks/useAdmin';
import { useAuth } from '@/features/auth/useAuth';
import type { AdminTicket, AdminUser, Priority, TicketCategory, TicketStatus } from '../../types';

interface ControlsCardProps {
  ticket: AdminTicket;
  onCategoryChanged?: (newCategory: TicketCategory) => void;
}

export function ControlsCard({ ticket, onCategoryChanged }: ControlsCardProps) {
  const { user } = useAuth();
  const { data: admins, isLoading: adminsLoading } = useAdmins();
  const patchTicketMutation = usePatchTicket();
  const assignMeMutation = useAssignMe();

  const [categoryChangedNotice, setCategoryChangedNotice] = React.useState(false);

  const isAssignedToMe = Boolean(user?.id && ticket.assignedToId === user.id);

  const handleStatusChange = (value: string) => {
    const status = value as TicketStatus;
    if (status === ticket.status) return;
    patchTicketMutation.mutate({
      id: ticket.id,
      payload: { status },
    });
  };

  const handleCategoryChange = (value: string) => {
    const category = value as TicketCategory;
    if (category === ticket.category) return;
    patchTicketMutation.mutate(
      {
        id: ticket.id,
        payload: { category },
      },
      {
        onSuccess: () => {
          setCategoryChangedNotice(true);
          onCategoryChanged?.(category);
        },
      },
    );
  };

  const handlePriorityChange = (value: string) => {
    const priority = value as Priority;
    if (priority === ticket.priority) return;
    patchTicketMutation.mutate({
      id: ticket.id,
      payload: { priority },
    });
  };

  const handleAssigneeChange = (value: string) => {
    const assignedToId = value === 'unassigned' ? null : value;
    if (assignedToId === ticket.assignedToId) return;
    patchTicketMutation.mutate({
      id: ticket.id,
      payload: { assignedToId },
    });
  };

  const handleAssignToMe = () => {
    if (isAssignedToMe || assignMeMutation.isPending) return;
    assignMeMutation.mutate(ticket.id);
  };

  return (
    <Card className="shadow-xs border-border bg-card rounded-xl">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-xs font-semibold flex items-center justify-between uppercase tracking-wider text-muted-foreground">
          <span>Ticket Controls</span>
          <span className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground normal-case">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            auto-saved
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Status Dropdown */}
        <div className="space-y-1.5">
          <Label htmlFor="control-status" className="text-xs font-medium text-muted-foreground">
            Status
          </Label>
          <Select
            value={ticket.status}
            onValueChange={handleStatusChange}
            disabled={patchTicketMutation.isPending}
          >
            <SelectTrigger id="control-status" className="h-8 text-xs font-medium">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category Dropdown */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="control-category" className="text-xs font-medium text-muted-foreground">
              Category
            </Label>
            {ticket.categorySource && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <SourceMarker source={ticket.categorySource} />
                <span className="text-[10px]">
                  {ticket.categorySource === 'AI' ? 'AI suggested' : 'Manual'}
                </span>
              </div>
            )}
          </div>
          <Select
            value={ticket.category || ''}
            onValueChange={handleCategoryChange}
            disabled={patchTicketMutation.isPending}
          >
            <SelectTrigger id="control-category" className="h-8 text-xs font-medium">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ROYALTY_PAYMENTS">Royalty & Payments</SelectItem>
              <SelectItem value="ISBN_METADATA">ISBN & Metadata Issues</SelectItem>
              <SelectItem value="PRINTING_QUALITY">Printing & Quality</SelectItem>
              <SelectItem value="DISTRIBUTION_AVAILABILITY">Distribution & Availability</SelectItem>
              <SelectItem value="BOOK_STATUS_PRODUCTION">Book Status & Production Updates</SelectItem>
              <SelectItem value="GENERAL_INQUIRY">General / Account Level</SelectItem>
            </SelectContent>
          </Select>

          {categoryChangedNotice && (
            <div className="flex items-start gap-1.5 p-2 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 text-xs border border-purple-200 dark:border-purple-800 animate-in fade-in">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                Category changed. You may want to regenerate the AI draft to reflect this policy.
              </div>
            </div>
          )}
        </div>

        {/* Priority Dropdown */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="control-priority" className="text-xs font-medium text-muted-foreground">
              Priority
            </Label>
            {ticket.prioritySource && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <SourceMarker source={ticket.prioritySource} />
                <span className="text-[10px]">
                  {ticket.prioritySource === 'AI' ? 'AI calculated' : 'Manual'}
                </span>
              </div>
            )}
          </div>
          <Select
            value={ticket.priority}
            onValueChange={handlePriorityChange}
            disabled={patchTicketMutation.isPending}
          >
            <SelectTrigger id="control-priority" className="h-8 text-xs font-medium">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="control-assignee" className="text-xs font-medium text-muted-foreground">
              Assignee
            </Label>
            {!isAssignedToMe && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAssignToMe}
                disabled={assignMeMutation.isPending}
                className="h-6 px-1.5 text-[11px] text-primary hover:text-primary gap-1"
              >
                <UserCheck className="h-3 w-3" />
                Assign to me
              </Button>
            )}
          </div>
          <Select
            value={ticket.assignedToId || 'unassigned'}
            onValueChange={handleAssigneeChange}
            disabled={patchTicketMutation.isPending || adminsLoading}
          >
            <SelectTrigger id="control-assignee" className="h-8 text-xs font-medium">
              <SelectValue placeholder={adminsLoading ? 'Loading admins...' : 'Unassigned'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {admins?.map((admin: AdminUser) => (
                <SelectItem key={admin.id} value={admin.id}>
                  {admin.name} {admin.id === user?.id ? '(You)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
