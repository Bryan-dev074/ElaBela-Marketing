import { getUser } from "@/lib/auth";
import DashboardView from "@/components/views/DashboardView";

export default async function DashboardPage() {
  const user = await getUser();
  return <DashboardView name={user?.fullName ?? "Equipo"} role={user?.role ?? "marketer"} />;
}
