import { getUser } from "@/lib/auth";
import DashboardView from "@/components/views/DashboardView";

export default async function DashboardPage() {
  const user = await getUser();
  return (
    <DashboardView
      name={user?.fullName ?? "Equipo"}
      username={user?.username ?? "bryan"}
      role={user?.role ?? "marketer"}
    />
  );
}
