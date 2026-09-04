import { createFileRoute } from "@tanstack/react-router";
import { FundGroupManager } from "@/components/portfolio/FundGroupManager";
export const Route=createFileRoute("/groups")({component:GroupsPage});
function GroupsPage(){return <div><FundGroupManager/></div>}
