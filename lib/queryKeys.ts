export const traceKeys = {
  all: ["traces"] as const,
  lists: (search?: string) => ["traces", "lists", search?.trim() || "all"] as const,
  detail: (id: string) => ["traces", "detail", id] as const,
};
