import { getUser } from "@/lib/auth";
import PerfilView from "@/components/views/PerfilView";

export default async function PerfilPage() {
  const user = await getUser();
  return (
    <PerfilView
      fullName={user?.fullName ?? "Equipo"}
      username={user?.username ?? "usuario"}
      role={user?.role ?? "marketer"}
    />
  );
}
