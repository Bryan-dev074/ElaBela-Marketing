import { getUser } from "@/lib/auth";
import CredencialesView from "@/components/views/CredencialesView";

export default async function CredencialesPage() {
  const user = await getUser();
  return <CredencialesView role={user?.role ?? "marketer"} />;
}
