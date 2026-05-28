import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/query";
import { useAuth } from "@/app/auth";
import type { ProfileRow } from "@/lib/database.types";

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.profile,
    enabled: !!user,
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ProfileRow>) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user!.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.profile }),
  });
}
