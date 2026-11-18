# Free hosting decision — 18 November 2026

The owner selected a free alternative. The paid Render Blueprint has not been approved and has no running resources. Do not ask for a payment method or apply the paid template unless the owner changes this choice.

Recommended path: **Render Free web service + Supabase Free persistent database/private file storage**. The Supabase connection has been suggested but is not confirmed. No Supabase project or free cloud database is provisioned yet.

This requires a real storage/authentication migration. The current app runs synchronously on Node 24 `node:sqlite` with server-local files. Changing only a plan or adding a database URL will not make that data durable on a free web service. Preserve the existing learning/palace evidence, stable content versions, idempotency, owner isolation, explicit self-grading, consent boundaries and export/delete behavior during the migration.

Keep the existing Next/Node interface. Use an async PostgreSQL repository with real transaction boundaries and a private storage adapter; decide custom owner-auth compatibility versus Supabase Auth based on the connected project. The optional `supabase/` schema is not already a runtime adapter. Use the shared IPv4 Session Pooler for a persistent IPv4 Node service when appropriate; do not select the paid IPv4 add-on by accident.

Verified official free-tier facts:

- Render Free web services sleep after 15 minutes without traffic and can take about a minute to resume. Local files disappear on spin-down, restart or deployment. There is no free persistent disk. The workspace shares 750 free instance hours/month. Without payment information, exceeding included limits can suspend the service rather than bill it.
- Supabase Free currently includes 500 MB database, 1 GB file storage, 50,000 MAU and 5 GB egress; two active projects. Projects can pause after a week without activity. Included automatic backups are not part of this plan.
- Render Free Postgres expires after 30 days and is unsuitable as the owner's permanent evidence store.
- Free tiers have limits and may change. This proposal does not claim unlimited or guaranteed production availability.

Sources: https://render.com/docs/free.md ; https://render.com/docs/your-first-deploy.md ; https://supabase.com/pricing ; https://supabase.com/docs/guides/database/connecting-to-postgres .

Next external prerequisite: add/connect Supabase. Do not ask the owner to paste passwords, connection secrets or API credentials into chat; use the connected service or a supported private environment binding. Configure only free resources. Test persistence across a real hosting restart before saying the cloud app is ready.
