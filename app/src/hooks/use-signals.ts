"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useSignalStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["signal-stats"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString();

      const [
        { count: totalToday },
        { count: unclassified },
        { count: needsResponse },
      ] = await Promise.all([
        supabase
          .from("signals")
          .select("*", { count: "exact", head: true })
          .gte("received_at", todayStart),
        supabase
          .from("signals")
          .select("*", { count: "exact", head: true })
          .is("classified_at", null),
        supabase
          .from("signals")
          .select("*", { count: "exact", head: true })
          .eq("requires_response", true)
          .in("ownership_signal", ["owner", "contributor"]),
      ]);

      return {
        totalToday: totalToday ?? 0,
        unclassified: unclassified ?? 0,
        needsResponse: needsResponse ?? 0,
      };
    },
  });
}
