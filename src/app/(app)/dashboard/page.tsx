"use client";

import { useUser } from "@/lib/user-context";
import DashboardView from "@/components/views/DashboardView";

export default function DashboardPage() {
  const u = useUser();
  return <DashboardView name={u.fullName} username={u.username} userId={u.id} role={u.role} />;
}
