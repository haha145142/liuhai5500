# Fund AI Pro 系统 Push

代码已经包含 PWA Service Worker、浏览器订阅、VAPID Web Push 发送端、官方净值/波动提醒以及 GitHub Actions 后台调度。

生产环境默认直接从现有 `CRON_SECRET` 派生稳定的 VAPID P-256 密钥，因此不要求新增私钥提交到 Git。也可以在 Vercel 单独配置 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY` 覆盖默认派生方式；`VAPID_SUBJECT` 可设置为 `mailto:你的邮箱`。

现有 `CRON_SECRET` 继续复用，用于 GitHub Actions 调用 `/api/push/dispatch` 与 `/api/push/test`。订阅数据保存到共享 Redis/KV。

浏览器首次开启通知时会注册 `/service-worker.js`。页面关闭后，浏览器仍可接收系统 Push，前提是操作系统和浏览器允许后台推送。

通知数据不使用虚拟净值。官方净值通知只在基金接口确认当日官方净值后发送；盘中波动提醒使用当前可靠盘中估算，并明确标记为盘中估算。
