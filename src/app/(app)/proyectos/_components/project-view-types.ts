export type ProjectSection = "active" | "completed" | "previous";

export type ProjectPendingOperation = {
  projectId: string;
  kind: "status" | "step" | "save" | "delete";
  stepIndex?: number;
} | null;
