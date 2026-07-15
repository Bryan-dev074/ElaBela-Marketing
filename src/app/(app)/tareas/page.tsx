import { getUser } from "@/lib/auth";
import TareasView from "@/components/views/TareasView";

export default async function TareasPage() {
  const user = await getUser();
  return <TareasView role={user?.role ?? "marketer"} username={user?.username ?? "cielo"} />;
}
