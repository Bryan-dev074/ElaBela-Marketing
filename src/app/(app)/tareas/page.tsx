"use client";

import { useUser } from "@/lib/user-context";
import TareasView from "@/components/views/TareasView";

export default function TareasPage() {
  const u = useUser();
  return <TareasView role={u.role} username={u.username} userId={u.id} />;
}
