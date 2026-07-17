"use client";

import { useUser } from "@/lib/user-context";
import CredencialesView from "@/components/views/CredencialesView";

export default function CredencialesPage() {
  const u = useUser();
  return <CredencialesView role={u.role} ownerId={u.id} />;
}
