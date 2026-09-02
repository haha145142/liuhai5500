import { createFileRoute } from "@tanstack/react-router";
import { RotationRadar } from "@/components/market/RotationRadar";

export const Route = createFileRoute("/rotation")({ component: RotationPage });

function RotationPage() {
  return <div><RotationRadar /></div>;
}
