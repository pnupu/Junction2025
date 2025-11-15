# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## AI recommendation scaffold

The onboarding preview now calls an OpenAI-powered tRPC endpoint. To enable live generations locally or in CI, add the following variables to `.env`:

```
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4o-mini # optional override
AGENT_CRON_SECRET=super-long-shared-secret # optional, protects cron route
```

When no key is present, the UI gracefully falls back to a local seed set so you can still demo the flow.

### Agent pipeline

- `ai.scoutOpportunities` (tRPC mutation) invokes the Event Scout agent, which calls OpenAI to discover venue-ready concepts (tennis courts, beaches, pools, etc.) and stores them in the new `EventOpportunity` table.
- `ai.recommendFromOpportunities` (tRPC query) powers the second agent: it reads stored opportunities, matches them to crew signals, and records `EventRecommendation` rows linked to the originating idea.
- Both agents gracefully fall back to curated seed data when no API key is configured so the flow remains demoable offline.
- Run both agents manually via `/start/operators`, or schedule the scout via `GET /api/cron/scout` (supply `x-cron-secret: $AGENT_CRON_SECRET` when set).
- Infrastructure data for Helsinki + Espoo is seeded from `data/infrastructure/*.json`. Run `npm run seed:venues` after pulling the repo to load real tennis courts, beaches, and swimming halls into the `InfrastructureVenue` table.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.
