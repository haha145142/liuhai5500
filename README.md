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
- Vercel automatically deploys new commits pushed to `main`.

## Notes

- Secrets and environment-specific values must stay outside Git.
- Historical reference implementations are kept under `attachments/` for later feature comparison and consolidation.
- Fund intraday valuation is calculated by Fund AI Pro from disclosed holdings and live underlying quotes; third-party estimates are used only for validation.
