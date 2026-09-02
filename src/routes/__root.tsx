import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import appCss from "../styles.css?url";
import uiPerformanceCss from "../ui-performance.css?url";
import liquidGlassCss from "../liquid-glass-v4.css?url";
import finalPolishCss from "../final-polish.css?url";
import homeLayoutCss from "../home-layout-v5.css?url";
import lightThemeCss from "../light-theme-v2.css?url";
import mobilePerformanceCss from "../mobile-performance-v6.css?url";
import fundAiProV6Css from "../fund-ai-pro-v6.css?url";
import finalIos26Css from "../ios26-final-override.css?url";
import designSystemCss from "../fund-ai-pro-design-system.css?url";
import uiFinalPassCss from "../ui-final-pass.css?url";
import compactPolishCss from "../predeploy-compact-polish.css?url";

const APP_NAME = "Fund AI Pro";

function HydrationMarker() {
  useEffect(() => {
    document.body.dataset.fapHydrated = "true";
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#EEF3F9" },
      { name: "color-scheme", content: "light" },
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
      { rel: "stylesheet", href: homeLayoutCss },
      { rel: "stylesheet", href: lightThemeCss },
      { rel: "stylesheet", href: mobilePerformanceCss },
      { rel: "stylesheet", href: fundAiProV6Css },
      { rel: "stylesheet", href: finalIos26Css },
      { rel: "stylesheet", href: designSystemCss },
      { rel: "stylesheet", href: uiFinalPassCss },
      { rel: "stylesheet", href: compactPolishCss },
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
            <HydrationMarker />
            <AppShell><Outlet /></AppShell>
          </AppErrorBoundary>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
