# Storypointless

What planning poker was meant to be.

Live at [storypointless.com](https://storypointless.com).

## What this is

Planning poker that surfaces the conversation, not the number. Your team votes on the Fibonacci scale they're used to, and the reveal shows who disagreed with whom instead of what anyone voted. The cards never come back out.

Why? Story points were always meant to start a conversation about complexity. Somewhere along the way they became commitments, velocity targets, sprint promises. Storypointless removes the number entirely so the conversation can come back to the front.

If your tracking tool insists on a number, write whatever you like in the box. The points were never the point.

## Stack

- **Frontend.** TypeScript, React, Tailwind v4, Vite. Static SPA on S3 behind CloudFront.
- **Backend.** TypeScript Lambda functions behind an API Gateway WebSocket API. State in a single DynamoDB table with 24h TTL.
- **Infrastructure.** AWS CDK (TypeScript). Three stacks: `CertStack` (us-east-1, CloudFront cert), `BackendStack` (eu-west-2, WS API + Lambdas + DDB), `FrontendStack` (eu-west-2, S3 + CloudFront + Route 53).
- No accounts, no persistence beyond a session, no numbers in the reveal.

## Layout

```
storypointless/
├── apps/
│   ├── server/         Lambda handlers, DynamoDB store, room logic
│   └── web/            React SPA, marketing page, voting + reveal
├── packages/
│   └── shared/         Wire types, scales, computeDisagreements (the algorithm)
├── infra/              CDK app + stacks
└── scripts/
    └── deploy.sh       End-to-end deploy
```

## Local development

```bash
npm install
npm run dev
```

Server runs on `:8787`, web on `:5173`. Open http://localhost:5173 in two browser windows to test the full loop end to end.

## Tests

```bash
npm test            # one-shot
npm run test:watch  # watch mode
```

The most important tests live in `packages/shared/src/disagreement.test.ts`. One of them is a philosophy invariant: the suite breaks if the reveal payload ever leaks numeric distance information through the wire.

## Deploy

```bash
npm run deploy
```

Idempotent. Bootstraps CDK, deploys all three stacks, builds the frontend with the WS URL baked in, syncs to S3, invalidates CloudFront, and activates the `Project` cost-allocation tag.

Needs AWS credentials in the default profile. The deploy script pins regions itself (eu-west-2 + us-east-1) and ignores whatever's in `~/.aws/config`.

## Cost protection

The backend is pay-per-use, so the stack includes layered defences against bill-runaway:

1. **Reserved concurrency** per Lambda (message: 50, connect: 20, disconnect: 20).
2. **API Gateway stage throttling** at 50 req/sec with 100 burst.
3. **Tag-scoped $50 monthly AWS Budget**. When tripped, AWS Budgets automatically attaches a deny-all IAM policy to the Lambda execution roles. The app stops working, the bill stops growing, you get an email.

To recover from a tripped kill switch, detach `storypointless-kill-switch` from the three Lambda roles in the IAM console (or wait for the next monthly cycle).

## Notable design choices

- **No numeric distance ever crosses the wire.** The reveal payload carries only participant-ID pairs and boolean signals. Even on hover, even in console logs, no card values leak from the server.
- **Vote attribution is double-checked.** Every participant-attributed action sends the client's `participantId`, and the server verifies it against the connection binding before applying. If they drift, the user gets a "session out of sync" error instead of a vote going to the wrong person.
- **Rooms auto-evaporate.** DynamoDB TTL drops rooms 24h after the last write. No history, no analytics, nothing to mine.
- **Host-only actions.** Whoever creates the room can reveal and start the next round. If the host disconnects, hosting passes to whoever's left. Anyone in the room can vote.
- **Deliberate anti-features.** No "agree on a final number" button, no average or median or consensus, no velocity tracking, no exporting estimates anywhere. If a feature would let the team turn the conversation back into a number, it does not exist.
