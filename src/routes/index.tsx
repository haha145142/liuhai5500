import { createFileRoute } from "@tanstack/react-router";
import { HomeDashboardV2 } from "@/components/home/HomeDashboardV2";
import { TodayAssessment } from "@/components/home/TodayAssessment";

export const Route = createFileRoute("/")({ component: Home });
function Home() {
  return (
    <>
      <TodayAssessment />
      <HomeDashboardV2 />
    </>
  );
}
