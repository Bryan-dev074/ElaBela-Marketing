"use client";

import { useUser } from "@/lib/user-context";
import PerfilView from "@/components/views/PerfilView";

export default function PerfilPage() {
  const u = useUser();
  return <PerfilView id={u.id} fullName={u.fullName} username={u.username} role={u.role} />;
}
