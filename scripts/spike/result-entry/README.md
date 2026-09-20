# Result-entry persistence spike

Executable evidence for the result-entry persistence contract: the schema, the interactive transaction transport,
the concurrency behaviour, the rating replay, the redaction path and the measured cost of one transition.

It is a spike harness, not part of the deployed application. Nothing here is imported by `app/` or `server/api/`.

## Running it

The harness rebuilds the `public` schema of whatever it is pointed at, so it refuses to guess a target. Bring up a
disposable PostgreSQL and the WebSocket proxy the Neon serverless driver dials, then run it:

```sh
./scripts/spike/result-entry/stack.sh
SPIKE_DATABASE_URL='postgres://spike:spike@pg-spike/spike' \
SPIKE_WS_PROXY='localhost:55433' \
  npx tsx --tsconfig tsconfig.tooling.json scripts/spike/result-entry/index.ts
```

`stack.sh` starts `postgres:17-alpine` and `ghcr.io/neondatabase/wsproxy` on an isolated Docker network, and is
idempotent — the runner calls it again if the socket drops mid-run.

## What the transport proof does and does not cover

`@neondatabase/serverless`, its wire protocol and its pooling are the deployed ones; only the endpoint differs. The
proxy stands in front of an ordinary PostgreSQL server rather than Neon's own. Latency, connection limits and pooler
behaviour on the hosted service are therefore **not** measured here, and every timing below is a floor rather than a
forecast.

## What is here and what is in the test suite

Everything that can be proved on one connection is a checked-in unit suite instead: `server/utils/results/utils.test.ts`
runs the same service functions against the real migrations on PGlite, and covers authorization, receipts, bounds, the
amendment state rule, the note-redaction rule and route resolution. This harness holds what a single session cannot
express — two transactions meeting on a lock — plus the transport proof and the cost measurements.

## Layout

| File                       | What it holds                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `harness.ts`               | Disposable database, migrations, league and roster fixtures, the local-proxy configuration |
| `scenarios-schema.ts`      | Schema and reconstruction checks                                                           |
| `scenarios-transaction.ts` | Transaction path, then concurrency and recovery across independent connections             |
| `scenarios-ratings.ts`     | Full-league replay, void equivalence, consistent reads, the public predicate               |
| `scenarios-privacy.ts`     | Dispute-note isolation and redaction                                                       |
| `scenarios-budget.ts`      | Runtime and storage measurements at 100, 1,000 and 10,000 eligible game rows               |
