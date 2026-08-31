import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import appCss from "../styles.css?url";
import uiPerformanceCss from "../ui-performance.css?url";
import liquidGlassCss from "../liquid-glass-v4.css?url";
import finalPolishCss from "../final-polish.css?url";

const APP_NAME = "Fund AI Pro";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#EEF3F9" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "description", content: "基金智能决策台 · 持仓估值、板块资金、新闻证据链" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: uiPerformanceCss },
      { rel: "stylesheet", href: liquidGlassCss },
      { rel: "stylesheet", href: finalPolishCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="zh-CN" className="antialiased" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <AppErrorBoundary>
            <AppShell><Outlet /></AppShell>
          </AppErrorBoundary>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
