import { createFileRoute } from "@tanstack/react-router";
import { HomeDashboardV2 } from "@/components/home/HomeDashboardV2";

export const Route = createFileRoute("/")({ component: Home });
function Home() {
  return <HomeDashboardV2 />;
}
