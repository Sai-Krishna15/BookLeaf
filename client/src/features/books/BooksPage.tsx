import { BookOpen } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';

export function BooksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Books"
        description="View your published books, in-production titles, and royalty earnings."
      />
      <EmptyState
        icon={BookOpen}
        title="Author Books Catalog"
        description="Your books and production tracking view will load here in Phase 10."
      />
    </div>
  );
}
export default BooksPage;
