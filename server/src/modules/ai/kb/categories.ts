import { TicketCategory } from '../../../generated/prisma/enums';

export interface FewShotExample {
  authorQuery: string;
  idealResponse: string;
}

export interface CannedSnippet {
  id: string;
  title: string;
  template: string;
}

export interface CategoryKbData {
  category: TicketCategory;
  policy: string;
  fewShots: FewShotExample[];
  cannedSnippets: CannedSnippet[];
}

// ---------------------------------------------------------------------------
// 1. ROYALTY_PAYMENTS
// ---------------------------------------------------------------------------

export const ROYALTY_PAYMENTS_KB: CategoryKbData = {
  category: TicketCategory.ROYALTY_PAYMENTS,
  policy: `Policy Facts:
- Payout Schedule: Calendar quarterly (Q1 ends Mar 31, Q2 ends Jun 30, Q3 ends Sep 30, Q4 ends Dec 31).
- Payout Window: Royalties are processed and disbursed within 45 days following the quarter close.
- Minimum Payout Threshold: ₹1,000. If pending royalty is under ₹1,000, it rolls over to the following quarter.
- Royalty Calculation: 80/20 net profit split (80% author, 20% BookLeaf). Net profit = MRP − Printing Cost − Retailer Commission (e.g., Amazon/Flipkart) − Shipping.
- Bank Details: Must be verified in dashboard. Unverified accounts retain balance safely in pending status.
- Escalation: If royalties are verified overdue past the 45-day window, escalate to the finance team with a firm 48-hour resolution timeline.`,
  fewShots: [
    {
      authorQuery: 'My book has been live for months and dashboard shows pending royalty, but I have not received any payout yet.',
      idealResponse:
`Hi Ananya,

Thank you for reaching out, and I completely understand your concern regarding your royalty payout for Between Two Temples.

Our royalties are calculated quarterly and distributed within 45 days after each quarter ends. Because your book was published earlier this year and your pending balance is ₹3,200, your payout was scheduled for the previous cycle. I see that this payment has not yet reached your bank account.

I apologize for this delay. I have escalated your payout directly to our finance team to verify your transaction reference. You will receive an update from us within 48 hours with the transfer status. In the meantime, please check your author dashboard to ensure your IFSC code and account details are up to date.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      authorQuery: 'Why has my royalty of Rs 850 not been credited to my account?',
      idealResponse:
`Hi Kavita,

Thank you for checking in on your royalties for The Nagpur Notebooks.

I looked into your dashboard, and your current pending royalty stands at ₹850. BookLeaf maintains a minimum payout threshold of ₹1,000 per cycle. Because your current earnings are below this threshold, the ₹850 has safely rolled over to the next quarter.

As soon as your cumulative royalties cross ₹1,000 at the end of the next quarter, our automated payout system will credit the entire amount directly to your registered bank account during the 45-day window. Please let me know if you would like a detailed sales report for your title.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
  cannedSnippets: [
    {
      id: 'royalty-threshold',
      title: 'Below ₹1,000 Threshold Explanation',
      template:
`Hi {authorFirstName},

Thank you for reaching out regarding your royalties for {bookTitle}.

Our policy requires a minimum accumulated royalty of ₹1,000 for quarterly disbursement. Your current pending earnings are below this threshold, so your balance has rolled over safely to the upcoming quarter. Once your total crosses ₹1,000, it will be paid within 45 days of quarter-end.

Please let us know if you need any further clarification.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'royalty-overdue-escalate',
      title: 'Overdue Royalty 48-Hour Escalation',
      template:
`Hi {authorFirstName},

Thank you for contacting us regarding your overdue royalty payment for {bookTitle}.

I sincerely apologize for the delay. Because your earnings are above our minimum threshold and past the scheduled 45-day payout window, I have escalated this directly to our accounts team. We will verify your transaction reference and update you within 48 hours.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'royalty-breakdown',
      title: 'Royalty Formula Breakdown (80/20)',
      template:
`Hi {authorFirstName},

Thank you for your inquiry about the royalty calculation on {bookTitle}.

BookLeaf operates on an 80/20 net profit model: you earn 80% of net profits (MRP minus printing, platform commission, and shipping fees). We are happy to provide a line-by-line statement of sales and deductions if you would like to review the breakdown.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. ISBN_METADATA
// ---------------------------------------------------------------------------

export const ISBN_METADATA_KB: CategoryKbData = {
  category: TicketCategory.ISBN_METADATA,
  policy: `Policy Facts:
- ISBN Assignment: Every published book receives a verified 13-digit ISBN registered with the national agency.
- High Priority Policy: ISBN errors and barcode mismatches are treated as HIGH priority because they block sales and harm book indexing.
- Barcode Accuracy: Barcode printed on the back cover must exactly reflect the registered 13-digit ISBN.
- Resolution Commitment: Mismatched or missing ISBN records on retail listings (Amazon, Flipkart) are escalated to the production catalog team with a 48-hour resolution timeline. Never blame third-party stores or the author.`,
  fewShots: [
    {
      authorQuery: 'The ISBN shown on the Amazon listing does not match the ISBN inside my book dashboard. Readers cannot find the edition.',
      idealResponse:
`Hi Diya,

Thank you for alerting us to this issue, and I apologize for the confusion caused to your readers regarding Durga's Daughters.

ISBN accuracy is critical to proper book indexing and distribution. I reviewed our catalog feeds and confirmed that the listing on Amazon was mapped to an outdated record rather than your official ISBN (978-93-12345-67-8).

I have escalated this ticket immediately to our production metadata team to push a corrected bibliographic feed to Amazon. This will be updated within 48 hours. I will personally monitor the listing and update you as soon as the live catalog refreshes.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
  cannedSnippets: [
    {
      id: 'isbn-escalation',
      title: 'ISBN Mismatch 48-Hour Escalation',
      template:
`Hi {authorFirstName},

Thank you for notifying us about the ISBN discrepancy for {bookTitle}.

ISBN accuracy is essential for distribution and cataloging, so I have escalated this directly to our production team. We are issuing an updated metadata feed to our retail partners and will resolve this within 48 hours. I will update you as soon as the live listing reflects the correct ISBN.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'isbn-details-info',
      title: 'ISBN Registration & Barcode Information',
      template:
`Hi {authorFirstName},

Thank you for your question regarding the ISBN for {bookTitle}.

Your 13-digit ISBN is officially registered and the high-resolution barcode is generated to match standard print specifications. If you need official registration certificates or barcode files for external use, please let us know and we will generate them for you.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. PRINTING_QUALITY
// ---------------------------------------------------------------------------

export const PRINTING_QUALITY_KB: CategoryKbData = {
  category: TicketCategory.PRINTING_QUALITY,
  policy: `Policy Facts:
- Quality Guarantee: 100% free reprint replacement guarantee for defective physical copies.
- Covered Defects: Blurry text, smudged ink, misaligned trimming, split spine/binding, missing pages, or damaged covers.
- Resolution Process: Apologize sincerely, acknowledge the defect, request clear photographs or unboxing video of the affected copies.
- Turnaround Time: Upon receiving photographic confirmation, replacement copies are printed and dispatched within 5-7 business days at zero cost to the author.`,
  fewShots: [
    {
      authorQuery: 'I received my author copies today but the spine binding is cracked and pages 30 to 45 have blurred ink.',
      idealResponse:
`Hi Vikram,

I am very sorry to hear that your author copies of Shadows over Silent Hills arrived in this condition. This is not the quality standard BookLeaf promises to our authors.

We stand by a 100% replacement guarantee for physical defects. Could you please reply to this email with 2-3 clear photographs showing the cracked spine and the blurred pages?

Once we verify the photos, our production team will immediately initiate a priority reprint and dispatch fresh copies to your address within 5-7 business days at no cost to you. We will ensure these copies undergo strict quality inspection prior to courier dispatch.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
  cannedSnippets: [
    {
      id: 'printing-request-photos',
      title: 'Request Photos for Defective Copies',
      template:
`Hi {authorFirstName},

I am deeply sorry that your copies of {bookTitle} arrived with physical defects. This falls short of our quality standards.

We provide a 100% free replacement guarantee for defective books. Please share 2 to 3 clear photos showing the damaged areas (such as the spine, binding, or pages). Upon receiving them, we will expedite a complimentary reprint and dispatch replacement copies within 5-7 business days.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'printing-reprint-confirmed',
      title: 'Free Reprint Dispatched (5-7 Days)',
      template:
`Hi {authorFirstName},

Thank you for providing the photographs of the defect on {bookTitle}.

Our quality team has approved your reprint request. A fresh batch of copies has been sent to our print partner under priority supervision. Your replacement books will be printed and shipped within 5-7 business days, and we will send tracking details as soon as they are on their way.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. DISTRIBUTION_AVAILABILITY
// ---------------------------------------------------------------------------

export const DISTRIBUTION_AVAILABILITY_KB: CategoryKbData = {
  category: TicketCategory.DISTRIBUTION_AVAILABILITY,
  policy: `Policy Facts:
- Retail Channels: Amazon India, Flipkart, BookLeaf Bookstore, and global eBook platforms (Kindle).
- Inventory & Availability: Paperback titles use Print-On-Demand (POD) distribution feeds. Automated stock sync anomalies can occasionally cause listings to show as "Temporarily out of stock" or "Unavailable".
- Resolution Commitment: When a listing shows unavailable, ops triggers an automated catalog & inventory re-sync feed with the retailer. Stock status updates take 24-48 hours to propagate across retailer servers.`,
  fewShots: [
    {
      authorQuery: 'My novel shows unavailable on Amazon and Flipkart. Readers are asking where to buy.',
      idealResponse:
`Hi Rohit,

Thank you for bringing this to our attention. I understand how concerning it is when readers cannot purchase your novel, Echoes of Eternity.

Our titles are distributed through automated Print-On-Demand feeds, and this listing status is caused by a periodic inventory synchronization delay between our distributor hub and Amazon/Flipkart. Your book remains active and ready for fulfillment.

I have initiated a priority catalog re-sync with both platforms today. The listing status will refresh to active and available within 24-48 hours. In the meantime, readers can order paperbacks directly through the BookLeaf Bookstore without delay.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
  cannedSnippets: [
    {
      id: 'distribution-sync-24-48h',
      title: 'Trigger Inventory Re-Sync (24-48h)',
      template:
`Hi {authorFirstName},

Thank you for notifying us about the availability status of {bookTitle}.

This is due to an inventory synchronization delay with retail platforms. I have triggered a priority inventory re-sync with our distribution partners. The listing will update to active within 24-48 hours. Readers can also order copies directly via the BookLeaf Bookstore in the interim.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'distribution-store-links',
      title: 'Retail Platform Availability Links',
      template:
`Hi {authorFirstName},

Thank you for checking in on the distribution of {bookTitle}.

Your book is distributed across Amazon, Flipkart, and the BookLeaf Bookstore. If you notice any pricing discrepancy or missing buy buttons on a particular platform, please share the exact product URL and we will coordinate with the platform's seller support.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. BOOK_STATUS_PRODUCTION
// ---------------------------------------------------------------------------

export const BOOK_STATUS_PRODUCTION_KB: CategoryKbData = {
  category: TicketCategory.BOOK_STATUS_PRODUCTION,
  policy: `Policy Facts:
- Publishing Pipeline Stages (in sequence):
  1. Manuscript Submission
  2. Editing (Content & Copy editing)
  3. Cover Design (requires author review & sign-off)
  4. Typesetting & Interior Formatting (takes 7-10 business days)
  5. Proofreading (manuscript proof review rounds)
  6. ISBN Assignment
  7. Printing
  8. Distribution
  9. Published & Live
- Collaborative Progress: Cover Design requires author feedback/approval of initial design concepts. Delays in proofreading often involve pending revision rounds.
- Communication Rule: Always state the exact current stage from the book facts, explain collaborative next steps, and provide a concrete timeframe.`,
  fewShots: [
    {
      authorQuery: 'My book Midnight in Mysore has been in Cover Design for weeks. Is there anything pending from me?',
      idealResponse:
`Hi Sneha,

Thank you for checking in on the progress of Midnight in Mysore.

Your book is currently in the Cover Design stage. In this phase, our design team produces front and back cover concepts for your review and approval. I checked with our design coordinator, and your initial front cover draft is ready for review.

We have uploaded the concept proofs to your author dashboard. Please review the typography and color palette, and submit your feedback or approval directly through the portal. Once you approve the artwork, your manuscript will advance to Typesetting within 2 business days.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      authorQuery: 'Raising Roots has been in typesetting for a while. When can I expect proofs?',
      idealResponse:
`Hi Kavita,

Thank you for following up on Raising Roots.

Your book is currently progressing through the Typesetting stage. Interior formatting and chapter page-setting typically take 7-10 business days to ensure accurate margins and typography.

Our production team confirmed that interior layout is currently 70% complete. You will receive your complete digital proof via the author dashboard within 48 hours for final proofreading review. Please let us know if you have any questions before then.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
  cannedSnippets: [
    {
      id: 'production-stage-update',
      title: 'Current Stage & Next Milestone Update',
      template:
`Hi {authorFirstName},

Thank you for checking in on the status of {bookTitle}.

Your book is currently in the production stage. Our team is actively working through the milestone requirements, and we expect the next review materials to be uploaded to your dashboard within 48 to 72 hours. We will notify you by email the moment they are ready for your review.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'production-typesetting-proofs',
      title: 'Typesetting Proofs Timeline (7-10 Days)',
      template:
`Hi {authorFirstName},

Thank you for checking in on the typesetting of {bookTitle}.

Interior formatting typically requires 7-10 business days for complete styling and proof preparation. We are finalizing your layout, and your digital proofs will be available on your author dashboard shortly for your review and sign-off.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. GENERAL_INQUIRY
// ---------------------------------------------------------------------------

export const GENERAL_INQUIRY_KB: CategoryKbData = {
  category: TicketCategory.GENERAL_INQUIRY,
  policy: `Policy Facts:
- Scope: Account credentials, portal dashboard navigation, author profile updates, general inquiries.
- Author Bio & Metadata Updates: Authors can update bio, synopsis, or headshots by submitting revised text via email or support ticket. Updates are synced to retailer pages within 3-5 business days.
- Marketing & Promotion: Authors receive digital promotional graphics upon publication; additional promotional packages are accessible via the author portal.`,
  fewShots: [
    {
      authorQuery: 'I would like to update my author bio and book description for The Saffron Diaries. How can I do that?',
      idealResponse:
`Hi Priya,

Thank you for reaching out to us. We would be glad to help you update your profile for The Saffron Diaries.

You can reply directly to this ticket with your revised author biography and updated book description. Once received, our team will review the text and update your author profile across the BookLeaf Bookstore, Amazon, and Flipkart within 3-5 business days.

Please send your updated text whenever you are ready, and let us know if you would also like to update your author photograph.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
  cannedSnippets: [
    {
      id: 'general-bio-update',
      title: 'Author Bio & Metadata Update (3-5 Days)',
      template:
`Hi {authorFirstName},

Thank you for reaching out regarding your profile details for {bookTitle}.

Please reply to this ticket with your revised biography, description, or author photo. Once we receive your text, our team will update your listings across all retail channels within 3-5 business days.

Warm regards,
BookLeaf Author Support Team`,
    },
    {
      id: 'general-account-support',
      title: 'General Account & Portal Support',
      template:
`Hi {authorFirstName},

Thank you for contacting BookLeaf Author Support.

We have noted your query and are reviewing your account details. If you have any additional information or screenshots to share, please reply directly to this message and our team will assist you promptly.

Warm regards,
BookLeaf Author Support Team`,
    },
  ],
};

// ---------------------------------------------------------------------------
// Category Map
// ---------------------------------------------------------------------------

export const CATEGORY_KB_MAP: Record<TicketCategory, CategoryKbData> = {
  [TicketCategory.ROYALTY_PAYMENTS]: ROYALTY_PAYMENTS_KB,
  [TicketCategory.ISBN_METADATA]: ISBN_METADATA_KB,
  [TicketCategory.PRINTING_QUALITY]: PRINTING_QUALITY_KB,
  [TicketCategory.DISTRIBUTION_AVAILABILITY]: DISTRIBUTION_AVAILABILITY_KB,
  [TicketCategory.BOOK_STATUS_PRODUCTION]: BOOK_STATUS_PRODUCTION_KB,
  [TicketCategory.GENERAL_INQUIRY]: GENERAL_INQUIRY_KB,
};
