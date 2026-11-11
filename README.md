# LendLoop

LendLoop is a neighborhood tool-lending board. Neighbors list tools they will lend, ask to borrow them for a range of dates, and approve or decline those requests. Notifications and overdue reminders are handled by n8n, not by the Next.js app.

Borrow what you need. Lend what you don't.

## Stack

- Next.js (App Router) and TypeScript for the interface
- Clerk for sign-in
- Convex for data and the authorization rules
- n8n, self-hosted with Docker, for the two automations

The app builds and the unit tests run without Clerk or Convex credentials. Live sign-in and live listings need the environment variables below.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local`, then in three terminals:

```bash
npx convex dev
npm run dev
docker compose --env-file .env.local up
```

The app is at [http://127.0.0.1:43123](http://127.0.0.1:43123). n8n is at [http://localhost:5678](http://localhost:5678). On the first n8n visit, create the owner account. That account is the only person who should be able to edit workflows, because workflow code can read the container environment.

### Clerk

1. Create a Clerk application and copy the publishable key and secret key into `.env.local`.
2. In Clerk, add a JWT template named `convex` with these claims:

```json
{
  "aud": "convex",
  "email": "{{user.primary_email_address}}",
  "name": "{{user.full_name}}"
}
```

3. Set the Convex environment variable `CLERK_JWT_ISSUER_DOMAIN` to the issuer from the Clerk JWT template, with no trailing path. Convex reads it from `convex/auth.config.ts`.
4. Set `ADMIN_EMAILS` in Convex to a comma-separated list. Those addresses become admins the next time they open the board. An admin who is later removed from the list stays an admin until you change the row. The app does not demote anyone from an env change.

### Convex

```bash
npx convex dev
npx convex env set CLERK_JWT_ISSUER_DOMAIN <issuer-from-clerk>
npx convex env set ADMIN_EMAILS you@example.com
npx convex env set LENDLOOP_OUTBOUND_WEBHOOK_SECRET "$(openssl rand -hex 32)"
npx convex env set LENDLOOP_INBOUND_WEBHOOK_SECRET "$(openssl rand -hex 32)"
```

Use the same two secrets in `.env.local` for the n8n container. Copy the Convex client URL into `NEXT_PUBLIC_CONVEX_URL`. `CONVEX_SITE_URL` is the HTTP actions URL from the same deployment.

### n8n

Import these files from **Workflows → Import from file**:

- `n8n/workflows/request-notification.json`
- `n8n/workflows/overdue-reminders.json`
- `n8n/workflows/error-handler.json`

On the request and reminder workflows, open **Settings** and set the error workflow to **LendLoop error handler**. n8n binds that setting by id, so the exported JSON cannot point at it safely. Publish all three.

Copy the production webhook URL. It should end in `/webhook/lendloop-request`. Put that full URL in Convex:

```bash
npx convex env set N8N_WEBHOOK_URL https://your-n8n-host/webhook/lendloop-request
```

Convex actions run in Convex's cloud, so they cannot call `http://localhost:5678`. For a local n8n, expose it with a tunnel and use that public URL. n8n calling Convex works without a tunnel, because `CONVEX_SITE_URL` is already public.

`NOTIFICATION_WEBHOOK_URL` is optional. Point it at a Slack-compatible incoming webhook if you want messages delivered somewhere. Leave it empty and the workflow still records the notification in the n8n execution and writes the activity line back to Convex.

Regenerate the workflow files after editing the builder:

```bash
npm run workflows
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js on port 43123 |
| `npm run build` | Production build |
| `npm run typecheck` | App TypeScript and the Convex project |
| `npm run lint` | ESLint |
| `npm test` | RBAC, HMAC, idempotency, and workflow checks |
| `npm run workflows` | Rebuild the n8n JSON from `scripts/build-n8n-workflows.mjs` |

## How the board behaves

Anyone can open the home page and see tools that are free to borrow. That query returns `name` and `category` only.

Signed-in neighbors can:

- List a tool with a name, category, condition, and short description
- Ask to borrow a tool for a date range of at most 30 days
- Approve or decline requests on their own tools
- Cancel their own pending request
- Mark a loan returned if they are the borrower or the lender
- Filter the board by category and open My listings, My requests, and Incoming

A tool is **available** when it has no approved loan covering today or the future. **On loan** wins over **reserved**. Pending requests do not block the tool. Dates are calendar days in UTC. A loan is overdue on the UTC day after its end date, and the reminder job runs at 08:00 UTC.

Admins, and only admins, can remove any listing, see every loan, and mark a neighbor as a trusted lender. Admins do not approve, decline, or return loans for other people. The owner decides.

Removing your own listing is blocked while a request is pending or a loan is still out. An admin removal cancels pending requests and tells the borrower. Approved loans stay so they can still be marked returned.

Each person can create 12 borrow requests per UTC day.

## Architecture

```text
Browser
  Clerk session
  Convex React client  --->  Convex queries and mutations
                                |  RBAC, validation, outbox row
                                |  scheduler.runAfter
                                v
                          Convex action
                                |  HMAC (outbound secret)
                                v
                          n8n webhook
                                |  verify, claim, notify, complete
                                |  HMAC (inbound secret)
                                v
                          Convex HTTP routes
                                reminders, claims, failures

n8n schedule (08:00 UTC)
  GET /overdue  ->  one item per loan  ->  POST /reminders
```

Convex is the system of record. n8n does not trust a body it cannot verify, and Convex does not trust a callback it cannot verify.

The notification path uses an outbox row. The mutation writes the row and schedules a dispatch. If the webhook is down, a Convex cron retries rows that are still pending, stuck processing, or failed. n8n claims the row before it sends, so a second delivery sees `send: false` unless the first claim went stale (15 minutes for notifications, 10 minutes for a reminder that never completed).

### HTTP routes

All of these live on the Convex site URL, not in Next.js.

| Route | Who calls it | Purpose |
| --- | --- | --- |
| `POST /webhook/lendloop-request` | Convex → n8n | New request or status change |
| `GET /overdue` | n8n → Convex | Loans with no successful reminder today |
| `POST /reminders` | n8n → Convex | Claim, complete, or fail a reminder |
| `POST /automation/claim` | n8n → Convex | Claim one notification |
| `POST /automation/complete` | n8n → Convex | Mark that notification delivered |
| `POST /automation/failure` | n8n → Convex | Record a visible failure |

### Signature

Both sides use the same canonical string:

```text
timestamp + "." + METHOD + "." + path + "." + hex(sha256(body))
HMAC-SHA256(secret) as hex, prefixed with "v1="
```

- Requests use the raw body bytes and the headers `X-LendLoop-Timestamp` and `X-LendLoop-Signature`.
- Responses are a JSON envelope `{ timestamp, signature, payload }`. The signature covers `stableStringify(payload)`, so key order does not matter. n8n checks the envelope before it uses the payload.
- Timestamps older or newer than 5 minutes are rejected.
- Comparison is length-checked and constant-time.
- Secrets shorter than 16 characters are treated as missing. The route then returns 503 and does nothing.
- Convex signs what it sends with `LENDLOOP_OUTBOUND_WEBHOOK_SECRET`. n8n signs what it sends with `LENDLOOP_INBOUND_WEBHOOK_SECRET`. One leaked secret cannot forge the other direction.

JSON objects are serialized with sorted keys and no extra whitespace before they are signed. The n8n code in `n8n/hmac-snippet.js` is checked against the TypeScript implementation in tests.

Duplicate completions are no-ops. A `sent` reminder is never rewritten as `failed`. A second claim on the same day does not send another reminder. Failure reports from the error workflow use the n8n execution id as their idempotency key.

## Security and data minimization

Authorization is in Convex mutations and queries. The buttons in the UI match those rules, but they are not the enforcement. Routes under `/board` are gated in `proxy.ts` with Clerk. Without Clerk keys, that file lets the request through and the page explains how to connect the services.

The public query maps each tool to `{ name, category }` before it returns. Owner ids, descriptions, and emails are not in that payload.

Signed-in board cards show the owner's name and a trusted-lender badge, because you need to know who you are asking. They do not show email. The admin list does show email, because that is how an admin tells two neighbors with the same first name apart.

Notification payloads contain the tool name, the dates, the status, the recipient's name and email, and the other person's name. They do not contain the description, condition, Clerk id, or either person's address. The email is there so a mail node can be swapped in. The message that is actually posted to Slack (or left in the n8n log) does not repeat the email address.

Overdue loans sent to n8n include the loan id, tool name, due date, and the borrower's name and email. The reminder text uses the name, tool, and due date. The borrower's email is dropped before the message is composed.

Failure text stored on a loan is trimmed, stripped of control characters, and has `v1=` signatures redacted.

Webhook routes do not use cookies and do not send CORS headers that browsers can use. A bad signature is a 401 with the reason logged on the server, not returned to the caller. Unknown business rules return 400 or 404. Idempotent repeats return 200 so n8n retries do not loop.

n8n 2 hides environment variables from workflows unless `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. The compose file turns that on because each signature is different and a static header credential cannot compute it. The cost is that anyone who can edit a workflow can read the n8n process environment, including these secrets. Keep the n8n owner account limited to the people who operate the automation.

## Production

- Run Next.js and Convex in their hosted environments. Point `N8N_WEBHOOK_URL` at n8n on a private network or behind SSO, not at a laptop.
- Put n8n on Postgres, keep `N8N_ENCRYPTION_KEY` stable, and do not publish the workflow editor.
- Rotate the two HMAC secrets together on both sides. There is no overlap window in this version.
- Replace the optional Slack webhook with a real mail provider. Keep the body limited to the sentence the workflow already builds.
- Paginate tools, loans, and automation events. The board currently stops at 200 listings. Loan activity is read per loan, which is fine at neighborhood size and noisy past that.
- Rate-limit the Convex HTTP routes at the edge. The app already caps reminder fan-out at 100 loans per run and borrow requests at 12 per person per day.
- Add an alert on the outbox rows that stay `failed`, and on executions of **LendLoop error handler**.
- Move the admin allow-list to a managed group if more than one operator needs it. The env var is enough for a neighborhood.

The unit tests cover the permission checks, the signature code, and the idempotency decisions. They do not call Clerk, Convex, or n8n. Those need the accounts in the setup section. A local n8n process is not reachable from Convex's cloud, so `N8N_WEBHOOK_URL` has to be a public URL.
