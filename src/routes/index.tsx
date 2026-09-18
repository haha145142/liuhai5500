import { createFileRoute } from "@tanstack/react-router";
import { HomeDashboardV2 } from "@/components/home/HomeDashboardV2";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  // 首页只放“我的钱”：持仓总收益 + 我的基金。
  // 指数、板块、市场判断、新闻全部归到“市场”tab，不再堆在首页。
  return <HomeDashboardV2 />;
}
