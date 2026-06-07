# SAST Shop

This repository is being migrated from a single Next.js app into a pnpm workspace for the SAST Shop frontend.

## Current Root App

The root Next.js app remains in place until the later mobile and desktop workspace apps are added. During this intermediate state, use the root scripts to validate the existing app and shared configuration:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The planned workspace app entry points are already reserved:

```bash
pnpm dev:mobile
pnpm dev:desktop
```

Those commands will start the mobile and desktop apps after the corresponding workspace packages are created in later tasks.
