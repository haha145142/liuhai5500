Production build uses repository source; stale tracked Vercel output is excluded from the source tree.

Deployment recovery: restored main to the last known READY source revision after the 2026-08-30 white-screen regression.

Production recovery trigger: 2026-08-30.

2026-08-31 verification: latest main source contains the DeepSeek test export fix and settings imports testDeepSeek directly from ./data/deepseek. This commit exists to trigger a fresh Vercel production build from the current main tree.

2026-09-01: triggered a fresh production build after adding the portfolio "近三个月" return period and strengthening the sector watchlist funding breakdown.