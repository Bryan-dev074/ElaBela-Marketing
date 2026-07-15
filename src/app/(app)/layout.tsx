import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={{ id: user.id, username: user.username, fullName: user.fullName, role: user.role }}>
      {children}
    </AppShell>
  );
}
