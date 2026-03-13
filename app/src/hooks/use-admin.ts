"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useAdmin() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .maybeSingle();

      if (error) throw error;
      return data?.is_admin === true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — admin status rarely changes
  });
}

export function useIsAdmin() {
  const { data: isAdmin, isLoading } = useAdmin();
  if (isLoading) return false;
  return isAdmin === true;
}
