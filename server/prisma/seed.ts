/* Idempotent seed (PROJECT_CONTEXT §11). Safe to run repeatedly.
 *
 * - Reference data (authors, books, users) is upserted from the JSON on each run, concurrently over
 *   the connection pool (one round trip per row, but ~10 in flight), so edits to the JSON apply.
 * - Demo tickets/messages are inserted with fixed ids via createMany({ skipDuplicates }): one query
 *   each, never duplicates, and never clobbers changes made through the app.
 *   Use `npm run db:reset` for a clean slate.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import {
  AiStatus,
  FieldSource,
  MessageType,
  Priority,
  PrismaClient,
  Role,
  TicketCategory,
  TicketStatus,
} from '../src/generated/prisma/client';

const BCRYPT_COST = 10;
const AUTHOR_PASSWORD = 'Test@1234';
const ADMIN_PASSWORD = 'Admin@1234';
const ADMINS = [
  { email: 'admin@bookleaf.com', name: 'BookLeaf Admin' },
  { email: 'ops@bookleaf.com', name: 'BookLeaf Ops' },
];

interface JsonBook {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}
interface JsonAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: JsonBook[];
}

const toDate = (v: string | null): Date | null => (v ? new Date(v) : null);
const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3_600_000);

function loadData(): JsonAuthor[] {
  const raw = readFileSync(path.join(__dirname, 'data', 'bookleaf_sample_data.json'), 'utf8');
  return (JSON.parse(raw) as { authors: JsonAuthor[] }).authors;
}

interface SeedMessage {
  from: 'author' | 'admin1' | 'admin2';
  type: MessageType;
  body: string;
  hoursAgo: number;
}
interface SeedTicket {
  number: number;
  authorId: string;
  bookId: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  category: TicketCategory;
  priority: Priority;
  /** AI = classified by model; FALLBACK = classified by keyword rules after AI failure. */
  source: FieldSource;
  aiStatus: AiStatus;
  aiReasoning?: string;
  aiError?: string;
  needsManualTriage?: boolean;
  assignedTo?: 'admin1' | 'admin2';
  createdHoursAgo: number;
  firstResponseHoursAgo?: number;
  resolvedHoursAgo?: number;
  messages: SeedMessage[];
}

const A = MessageType.ADMIN_REPLY;
const N = MessageType.INTERNAL_NOTE;

const TICKETS: SeedTicket[] = [
  {
    number: 1001,
    authorId: 'AUTH003', // Ananya Reddy, BK005 never paid
    bookId: 'BK005',
    subject: 'I have not received any royalty payment yet',
    description:
      'My book Between Two Temples has been live for a while and the dashboard shows pending royalty, but I have never received a single payout. Can you tell me when I will be paid?',
    status: TicketStatus.OPEN,
    category: TicketCategory.ROYALTY_PAYMENTS,
    priority: Priority.HIGH,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'Author has never received a payout on a published book; royalty is past the usual window.',
    createdHoursAgo: 80,
    messages: [],
  },
  {
    number: 1002,
    authorId: 'AUTH009', // Kavita, BK016 below threshold
    bookId: 'BK016',
    subject: 'Why has my royalty of Rs 850 not been paid?',
    description:
      'The Nagpur Notebooks shows Rs 850 pending royalty but I have not been paid anything. Is something wrong with my account or bank details?',
    status: TicketStatus.OPEN,
    category: TicketCategory.ROYALTY_PAYMENTS,
    priority: Priority.MEDIUM,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'Pending royalty below the Rs 1,000 minimum payout; a policy explanation resolves it.',
    createdHoursAgo: 30,
    messages: [],
  },
  {
    number: 1003,
    authorId: 'AUTH009', // Kavita, BK015 typesetting
    bookId: 'BK015',
    subject: 'Status of Raising Roots typesetting',
    description:
      'Raising Roots has been in typesetting for a while. Could you share where it stands and when I can expect the proofs?',
    status: TicketStatus.IN_PROGRESS,
    category: TicketCategory.BOOK_STATUS_PRODUCTION,
    priority: Priority.MEDIUM,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'Status/timeline check on a book currently in typesetting.',
    assignedTo: 'admin1',
    createdHoursAgo: 52,
    firstResponseHoursAgo: 40,
    messages: [
      {
        from: 'admin1',
        type: A,
        body: 'Hello Kavita, thank you for checking in. Raising Roots is currently in Typesetting. I have asked the production team for the exact proof date and will update you within 48 hours.\n\nBookLeaf Author Support Team',
        hoursAgo: 40,
      },
      {
        from: 'admin1',
        type: N,
        body: 'Production confirmed layout is 70% done. Waiting on the final chapter images.',
        hoursAgo: 38,
      },
    ],
  },
  {
    number: 1004,
    authorId: 'AUTH007', // Sneha, BK013 cover design
    bookId: 'BK013',
    subject: 'Midnight in Mysore is taking long in cover design',
    description:
      'My book Midnight in Mysore has been in the Cover Design stage for weeks. Is there something pending from my side? When will it move forward?',
    status: TicketStatus.OPEN,
    category: TicketCategory.BOOK_STATUS_PRODUCTION,
    priority: Priority.MEDIUM,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'Timeline query for a book in cover design, which waits on author approval.',
    createdHoursAgo: 20,
    messages: [],
  },
  {
    number: 1005,
    authorId: 'AUTH010', // Diya, BK017 ISBN mismatch
    bookId: 'BK017',
    subject: 'ISBN on Amazon does not match my book',
    description:
      'The ISBN shown on the Amazon listing for Durga’s Daughters is different from the ISBN in my dashboard. Please fix this urgently, readers cannot find the right edition.',
    status: TicketStatus.IN_PROGRESS,
    category: TicketCategory.ISBN_METADATA,
    priority: Priority.HIGH,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'ISBN mismatch between listing and records; ISBN issues are always high priority.',
    assignedTo: 'admin2',
    createdHoursAgo: 26,
    firstResponseHoursAgo: 22,
    messages: [
      {
        from: 'admin2',
        type: A,
        body: 'Hello Diya, I am sorry about the mismatch. I have escalated this to our production team to correct the ISBN on the Amazon listing, and you will hear back within 48 hours.\n\nBookLeaf Author Support Team',
        hoursAgo: 22,
      },
      {
        from: 'admin2',
        type: N,
        body: 'Only admins can see this: metadata sheet shows the right ISBN, the listing was built from an older record. Raised with distribution.',
        hoursAgo: 21,
      },
      {
        from: 'author',
        type: MessageType.AUTHOR_MESSAGE,
        body: 'Thank you. Please keep me posted, I have a book event this weekend.',
        hoursAgo: 18,
      },
    ],
  },
  {
    number: 1006,
    authorId: 'AUTH001', // Priya, resolved with reply
    bookId: 'BK002',
    subject: 'How do I update my author bio on the book page?',
    description:
      'I would like to update my author bio and book description for The Saffron Diaries. How can I do that?',
    status: TicketStatus.RESOLVED,
    category: TicketCategory.GENERAL_INQUIRY,
    priority: Priority.LOW,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'How-to question about metadata updates.',
    assignedTo: 'admin1',
    createdHoursAgo: 120,
    firstResponseHoursAgo: 110,
    resolvedHoursAgo: 100,
    messages: [
      {
        from: 'admin1',
        type: A,
        body: 'Hello Priya, you can send the new bio and description to us via the dashboard or by email. We will update the listings within 3-5 business days. Please send them over whenever you are ready.\n\nBookLeaf Author Support Team',
        hoursAgo: 110,
      },
      {
        from: 'author',
        type: MessageType.AUTHOR_MESSAGE,
        body: 'Got it, I have emailed the updated text. Thanks!',
        hoursAgo: 105,
      },
    ],
  },
  {
    number: 1007,
    authorId: 'AUTH002', // Rohit, Amazon UK availability
    bookId: 'BK004',
    subject: 'Startup Sutra shows unavailable on Amazon UK',
    description:
      'Readers in the UK tell me Startup Sutra shows as currently unavailable on Amazon UK, even though my dashboard lists it there.',
    status: TicketStatus.OPEN,
    category: TicketCategory.DISTRIBUTION_AVAILABILITY,
    priority: Priority.HIGH,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'Book unavailable on a sales platform where it should be live.',
    createdHoursAgo: 8,
    messages: [],
  },
  {
    number: 1008,
    authorId: 'AUTH005', // Meera, print quality
    bookId: 'BK009',
    subject: 'Printed copies of my book have blurry pages',
    description:
      'I ordered author copies of Letters from Lakshadweep and several pages in the middle are blurry and the binding is loose. This is not acceptable for a book I am selling.',
    status: TicketStatus.IN_PROGRESS,
    category: TicketCategory.PRINTING_QUALITY,
    priority: Priority.HIGH,
    source: FieldSource.AI,
    aiStatus: AiStatus.DONE,
    aiReasoning: 'Reported print defects (blurry pages, loose binding): at least HIGH.',
    assignedTo: 'admin2',
    createdHoursAgo: 60,
    firstResponseHoursAgo: 55,
    messages: [
      {
        from: 'admin2',
        type: A,
        body: 'Hello Meera, I am sorry your copies arrived like this. Please share a few photos of the affected pages and we will arrange a free reprint after verification, usually within 5-7 business days.\n\nBookLeaf Author Support Team',
        hoursAgo: 55,
      },
    ],
  },
  {
    number: 1009,
    authorId: 'AUTH006', // Arjun, general / account level, AI failed
    bookId: null,
    subject: 'Question about my account and payments',
    description:
      'I have not seen any payout in my account since my book was published. Please check my account and let me know what is going on with my payments.',
    status: TicketStatus.OPEN,
    category: TicketCategory.ROYALTY_PAYMENTS,
    priority: Priority.MEDIUM,
    source: FieldSource.FALLBACK, // keyword rules, not the model
    aiStatus: AiStatus.FAILED,
    aiError: 'AI_UNAVAILABLE: all providers failed (seeded example)',
    needsManualTriage: true,
    createdHoursAgo: 4,
    messages: [],
  },
];

export interface SeedSummary {
  authors: number;
  books: number;
  users: number;
  tickets: number;
}

export async function runSeed(prisma: PrismaClient, log: (m: string) => void = () => {}): Promise<SeedSummary> {
  const authors = loadData();
  const [authorHash, adminHash] = await Promise.all([
    bcrypt.hash(AUTHOR_PASSWORD, BCRYPT_COST),
    bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST),
  ]);

  // 1) Authors (stored values are the source of truth, nothing is recomputed).
  await Promise.all(
    authors.map((a) => {
      const data = { name: a.name, email: a.email, phone: a.phone, city: a.city, joinedDate: new Date(a.joined_date) };
      return prisma.author.upsert({ where: { id: a.author_id }, create: { id: a.author_id, ...data }, update: data });
    }),
  );

  // 2) Books + users depend only on authors, so they run concurrently with each other.
  const bookUpserts = authors.flatMap((a) =>
    a.books.map((b) => {
      const data = {
        authorId: a.author_id,
        title: b.title,
        isbn: b.isbn,
        genre: b.genre,
        publicationDate: toDate(b.publication_date),
        status: b.status,
        mrp: b.mrp,
        authorRoyaltyPerCopy: b.author_royalty_per_copy,
        totalCopiesSold: b.total_copies_sold,
        totalRoyaltyEarned: b.total_royalty_earned,
        royaltyPaid: b.royalty_paid,
        royaltyPending: b.royalty_pending,
        lastRoyaltyPayoutDate: toDate(b.last_royalty_payout_date),
        printPartner: b.print_partner,
        availableOn: b.available_on,
      };
      return prisma.book.upsert({ where: { id: b.book_id }, create: { id: b.book_id, ...data }, update: data });
    }),
  );
  const userUpserts = [
    ...authors.map((a) => {
      const data = { name: a.name, role: Role.AUTHOR, authorId: a.author_id, passwordHash: authorHash };
      return prisma.user.upsert({ where: { email: a.email }, create: { email: a.email, ...data }, update: data });
    }),
    ...ADMINS.map((adm) => {
      const data = { name: adm.name, role: Role.ADMIN, passwordHash: adminHash };
      return prisma.user.upsert({ where: { email: adm.email }, create: { email: adm.email, ...data }, update: data });
    }),
  ];
  await Promise.all([...bookUpserts, ...userUpserts]);
  log('authors, books, users upserted');

  // 3) Resolve user ids with ONE query.
  const users = await prisma.user.findMany({ select: { id: true, email: true, authorId: true } });
  const adminIds = {
    admin1: users.find((u) => u.email === ADMINS[0]!.email)!.id,
    admin2: users.find((u) => u.email === ADMINS[1]!.email)!.id,
  };
  const authorUserId = new Map(users.filter((u) => u.authorId).map((u) => [u.authorId as string, u.id]));

  // 4) Demo tickets + messages: fixed ids, insert-only (skipDuplicates keeps it idempotent).
  await prisma.ticket.createMany({
    skipDuplicates: true,
    data: TICKETS.map((t) => ({
      id: `seed-ticket-${t.number}`,
      ticketNumber: t.number,
      authorId: t.authorId,
      bookId: t.bookId,
      subject: t.subject,
      description: t.description,
      status: t.status,
      category: t.category,
      categorySource: t.source,
      priority: t.priority,
      prioritySource: t.source,
      aiStatus: t.aiStatus,
      aiReasoning: t.aiReasoning ?? null,
      aiError: t.aiError ?? null,
      needsManualTriage: t.needsManualTriage ?? false,
      assignedToId: t.assignedTo ? adminIds[t.assignedTo] : null,
      firstResponseAt: t.firstResponseHoursAgo !== undefined ? hoursAgo(t.firstResponseHoursAgo) : null,
      resolvedAt: t.resolvedHoursAgo !== undefined ? hoursAgo(t.resolvedHoursAgo) : null,
      createdAt: hoursAgo(t.createdHoursAgo),
    })),
  });

  await prisma.ticketMessage.createMany({
    skipDuplicates: true,
    data: TICKETS.flatMap((t) => {
      // The author's original query is also the first thread message.
      const thread: SeedMessage[] = [
        { from: 'author', type: MessageType.AUTHOR_MESSAGE, body: t.description, hoursAgo: t.createdHoursAgo },
        ...t.messages,
      ];
      return thread.map((m, i) => ({
        id: `seed-msg-${t.number}-${i + 1}`,
        ticketId: `seed-ticket-${t.number}`,
        senderId: m.from === 'author' ? authorUserId.get(t.authorId)! : adminIds[m.from],
        type: m.type,
        body: m.body,
        createdAt: hoursAgo(m.hoursAgo),
      }));
    }),
  });

  // Seeded rows set ticketNumber explicitly, so move the sequence past them.
  // GREATEST also includes the sequence's current last_value so concurrent runSeed calls
  // can never lower a value that was already allocated by nextval() in a parallel API request.
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"Ticket"', 'ticketNumber'),
      GREATEST(
        (SELECT last_value FROM "Ticket_ticketNumber_seq"),
        (SELECT COALESCE(MAX("ticketNumber"), 0) FROM "Ticket"),
        1000
      )
    )
  `);
  log('tickets and messages inserted');

  const [authorCount, bookCount, userCount, ticketCount] = await Promise.all([
    prisma.author.count(),
    prisma.book.count(),
    prisma.user.count(),
    prisma.ticket.count(),
  ]);
  return { authors: authorCount, books: bookCount, users: userCount, tickets: ticketCount };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const summary = await runSeed(prisma, (m) => console.log(`[seed] ${m}`));
    console.log('[seed] done', summary);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
}
