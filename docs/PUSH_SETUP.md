# Fund AI Pro 系统 Push

代码已经包含 PWA Service Worker、浏览器订阅、VAPID Web Push 发送端、官方净值/波动提醒以及 GitHub Actions 后台调度。

Vercel Production 需要配置三个环境变量：

- `VAPID_PUBLIC_KEY`：P-256 公钥，base64url
- `VAPID_PRIVATE_KEY`：对应的 32 字节私钥，base64url；只放在 Vercel，绝不能提交 Git
- `VAPID_SUBJECT`：建议使用 `mailto:你的邮箱`

现有 `CRON_SECRET` 继续复用，用于 GitHub Actions 调用 `/api/push/dispatch` 与 `/api/push/test`。

浏览器首次开启通知时会注册 `/service-worker.js` 并把订阅保存到共享 Redis/KV。之后浏览器页面关闭也可以收到系统通知，前提是操作系统和浏览器允许后台推送。

通知数据不使用虚拟净值。官方净值通知只在基金接口确认当日官方净值后发送；盘中波动提醒使用当前可靠盘中估算，并明确标记为盘中估算。
