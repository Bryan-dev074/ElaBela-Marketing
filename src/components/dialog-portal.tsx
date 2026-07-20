"use client";

import { createContext, useContext, type RefObject } from "react";

export const DialogPortalHostContext = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function useDialogPortalTarget() {
  const hostRef = useContext(DialogPortalHostContext);
  if (typeof document === "undefined") return null;
  return hostRef?.current ?? document.body;
}
