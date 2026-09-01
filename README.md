# liuhai5500

Grok workspace project, cleaned for GitHub version control.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Deployment

- Direct commits are made to `main`.
- Vercel deploys the latest `main` commit to production.
- Every completed batch must be synced to `main` before the next feature batch.

## Notes

- Secrets and environment-specific values must stay outside Git.
- Historical reference implementations are kept under `attachments/` for later feature comparison and consolidation.
- Live fund valuation is calculated locally from disclosed holdings and live underlying prices; third-party estimates are validation references, not the displayed source of truth.

<!-- production-deploy-sync: 2026-09-01 -->
