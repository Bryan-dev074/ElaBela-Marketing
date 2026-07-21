import type { TaskState } from "@/lib/data";
import type { ProjectSection as DomainProjectSection } from "@/lib/projects";

export type ProjectSection = "active" | "completed" | "previous";

export type ProjectPendingOperation = {
  projectId: string;
  kind: "status" | "step" | "save" | "delete";
  operationId: number;
  stepIndex?: number;
  sourceSection?: DomainProjectSection;
  targetStatus?: TaskState;
} | null;

export type ProjectPendingOperations = Partial<Record<string, Exclude<ProjectPendingOperation, null>>>;

export type ProjectErrors = Partial<Record<string, string>>;
