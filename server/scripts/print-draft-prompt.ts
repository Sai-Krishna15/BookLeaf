import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import { buildDraftContext } from '../src/modules/ai/context.builder';
import {
  buildDraftSystemPrompt,
  buildDraftUserPrompt,
} from '../src/modules/ai/prompts/draft.prompt';
import { isBelowPayoutThreshold } from '../src/common/royalty';

async function main() {
  const ticketId = process.argv[2];
  if (!ticketId) {
    console.error('Usage: tsx scripts/print-draft-prompt.ts <ticketId>');
    process.exit(1);
  }

  // Fetch ticket with relations matching AI draft generation logic
  const ticket = await prisma.ticket.findFirst({
    where: {
      OR: [{ id: ticketId }, { ticketNumber: isNaN(Number(ticketId)) ? -1 : Number(ticketId) }],
    },
    include: {
      author: {
        include: {
          books: {
            select: {
              id: true,
              status: true,
              totalRoyaltyEarned: true,
              royaltyPaid: true,
              royaltyPending: true,
            },
          },
        },
      },
      book: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          body: true,
          createdAt: true,
          sender: { select: { name: true } },
        },
      },
    },
  });

  if (!ticket) {
    console.error(`Ticket not found for identifier: ${ticketId}`);
    process.exit(1);
  }

  // Compute author totals
  const authorTotals = ticket.author.books.reduce(
    (acc, b) => ({
      totalRoyaltyEarned: acc.totalRoyaltyEarned + b.totalRoyaltyEarned,
      royaltyPaid: acc.royaltyPaid + b.royaltyPaid,
      royaltyPending: acc.royaltyPending + b.royaltyPending,
      belowPayoutThreshold: false,
    }),
    { totalRoyaltyEarned: 0, royaltyPaid: 0, royaltyPending: 0, belowPayoutThreshold: false },
  );
  authorTotals.belowPayoutThreshold = isBelowPayoutThreshold(authorTotals.royaltyPending);

  // Build Draft Context
  const context = buildDraftContext({
    ticket: {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      description: ticket.description,
      category: ticket.category,
      createdAt: ticket.createdAt,
    },
    author: {
      id: ticket.author.id,
      name: ticket.author.name,
    },
    book: ticket.book,
    authorTotals,
    messages: ticket.messages.map((m) => ({
      id: m.id,
      type: m.type,
      body: m.body,
      createdAt: m.createdAt,
      senderName: m.sender.name,
    })),
  });

  const systemPrompt = buildDraftSystemPrompt(context.authorFirstName);
  const userPrompt = buildDraftUserPrompt(context);

  console.log('='.repeat(80));
  console.log(`DIAGNOSTIC DRAFT PROMPT FOR TICKET ${ticket.ticketNumber} (${ticket.id})`);
  console.log('='.repeat(80));

  console.log('\n--- 1. MESSAGES IN DATABASE & INCLUSION STATUS ---');
  console.log(`Total messages in DB: ${ticket.messages.length}`);
  ticket.messages.forEach((m, idx) => {
    const included = context.recentMessages.some(
      (rm) => rm.text.includes(m.body.trim().slice(0, 30)),
    );
    console.log(
      `[#${idx + 1}] ID: ${m.id} | Type: ${m.type.padEnd(14)} | Created: ${m.createdAt.toISOString()} | Included in context: ${included ? 'YES' : 'NO'}`,
    );
    console.log(`     Preview: "${m.body.trim().slice(0, 80).replace(/\n/g, ' ')}..."`);
  });

  console.log('\n--- 2. CONTEXT & BUDGET SUMMARY ---');
  console.log(`Original ticket description length: ${ticket.description.length} chars`);
  console.log(`Context recent messages count: ${context.recentMessages.length}`);
  console.log(`System prompt characters: ${systemPrompt.length} chars (~${Math.round(systemPrompt.length / 4)} tokens)`);
  console.log(`User prompt characters:   ${userPrompt.length} chars (~${Math.round(userPrompt.length / 4)} tokens)`);
  console.log(`Total prompt characters:  ${systemPrompt.length + userPrompt.length} chars (~${Math.round((systemPrompt.length + userPrompt.length) / 4)} tokens)`);

  console.log('\n--- 3. FINAL SYSTEM PROMPT ---');
  console.log(systemPrompt);

  console.log('\n--- 4. FINAL USER PROMPT ---');
  console.log(userPrompt);
  console.log('='.repeat(80));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
