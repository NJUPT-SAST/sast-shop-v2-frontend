# Protocol source snapshot

The backend repository `sast-shop-v2/proto` is authoritative. This reviewed
snapshot lets the frontend generate the same interfaces before the backend
module is published to the Buf registry, and makes clean builds reproducible.

From the frontend repository, run:

```sh
node scripts/sync-proto.mjs ../sast-shop-v2
pnpm proto:generate
```

Commit source snapshots and generated TypeScript together. Never edit generated
TypeScript to introduce an RPC or field. Update the backend protocol first.
