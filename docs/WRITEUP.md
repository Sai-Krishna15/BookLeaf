# Engineering Reflection: Building the BookLeaf Support Portal

When designing the BookLeaf Author Support Portal, my primary goal was to build a system that authors and support operators could trust unconditionally. In customer support, an AI system that hallucinates financial promises, reveals internal triage notes, or leaves users staring at spinning loaders destroys trust immediately. I therefore chose to prioritize operational reliability, rock-solid data isolation, and human-in-the-loop workflows over decorative AI novelty.

### Approach & Core Priorities

I approached the product from two distinct vantage points: the anxious author inquiring about unpaid royalties or production deadlines, and the overloaded support administrator triaging dozens of incoming requests.

For the author, predictability and clarity are essential. I prioritized clear financial transparency (such as explaining why a ₹850 balance rolls over past the ₹1,000 threshold), an explicit 9-stage production timeline tracker for unpublished titles, and strict conversation privacy. Internal triage notes, AI confidence scores, and raw categories are stripped at the database query level so an author can never see them, even if client-side code were modified.

For the administrator, speed and triage efficiency matter most. I built an urgency-driven triage queue using database-level SQL ordering rather than client-side sorting. Tickets with unresolved statuses, higher priority weights, and older creation dates surface immediately. When an administrator opens a ticket, the AI assistant delivers a category-relevant draft pre-populated with verified book metadata, financial facts, and Knowledge Base guidelines. The administrator retains final editorial authority: drafts are never auto-sent, every edit is tracked, and manual snippets are readily available if the AI provider goes offline.

### Pragmatic Trade-offs

To deliver a production-ready application within the project's timeline and infrastructure constraints, I made several deliberate trade-offs:

1. **In-Memory Rate Limiting & Queue**: I implemented rate limiting and asynchronous job throttling using `p-queue` in-process rather than introducing external Redis infrastructure. This keeps the deployment simple, zero-cost, and self-contained on single-instance hosting.
2. **UI-Level File Attachments**: The author interface provides a full drag-and-drop attachment experience and records file metadata, but does not upload binary payloads to external blob storage.
3. **Draft Generation on Demand**: Rather than generating drafts in the background for every incoming ticket, drafts are generated only when an administrator opens a ticket. This avoids consuming API token budgets on tickets that are resolved or assigned directly without AI assistance.

### Production Evolution & Scaling Roadmap

To scale BookLeaf to thousands of active authors and tens of thousands of monthly tickets, I would evolve the architecture along the following dimensions:

- **Distributed Task Queues**: Replace in-process job handling with BullMQ backed by Redis clusters to isolate CPU-intensive LLM workflows into dedicated worker processes.
- **Horizontal Real-Time Scaling**: Attach the Socket.IO Redis adapter so WebSocket connections scale smoothly across multiple load-balanced application containers.
- **Cloud Object Storage**: Integrate AWS S3 or Cloudflare R2 presigned upload URLs for manuscript proofs, covers, and defect photos.
- **Enterprise Security & Observability**: Introduce JWT refresh-token rotation with Redis-backed revocation lists, immutable audit logging for all ticket mutations, OpenTelemetry distributed tracing, and automated SLA breach alerts delivered via Slack or PagerDuty.
- **RAG & Draft Analytics**: Expand the Knowledge Base into a vector-search RAG pipeline and track administrator edit rates to continuously evaluate and improve AI draft accuracy.
