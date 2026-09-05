import { createFileRoute } from "@tanstack/react-router";
import { HomeDashboardV2 } from "@/components/home/HomeDashboardV2";
import { IndexGrid } from "@/components/market/IndexGrid";
import { useApp } from "@/lib/store";
import { Glass, SectionTitle } from "@/components/ui/Glass";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const indices = useApp((s) => s.snapshot?.indices ?? []);

  return (
    <>
      <Glass className="mt-0 rounded-[26px] p-3">
        <SectionTitle title="A股核心指数" hint="上证 · 深证 · 沪深300 · 中证500 · 创业板 · 科创50" />
        <IndexGrid indices={indices} />
      </Glass>
      <HomeDashboardV2 />
    </>
  );
}
