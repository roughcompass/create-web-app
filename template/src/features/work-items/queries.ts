import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createWorkItem, listWorkItems, updateWorkItem } from "./api";

export const workItemQueryKey = ["work-items"] as const;

export function useWorkItems() {
  return useQuery({
    queryKey: workItemQueryKey,
    queryFn: ({ signal }) => listWorkItems(signal),
  });
}

export function useCreateWorkItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createWorkItem,
    onSuccess: async () => client.invalidateQueries({ queryKey: workItemQueryKey }),
  });
}

export function useUpdateWorkItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateWorkItem,
    onSuccess: async () => client.invalidateQueries({ queryKey: workItemQueryKey }),
  });
}