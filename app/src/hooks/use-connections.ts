"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

interface Connection {
  id: string;
  provider: string;
  email: string | null;
  status: string;
  last_sync_at: string | null;
}

export function useConnections() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("integration_connections")
        .select("id, provider, email, status, last_sync_at")
        .eq("status", "active");

      if (error) throw error;
      return data as Connection[];
    },
  });
}

export function useHasConnection(provider: "google" | "slack") {
  const { data: connections } = useConnections();
  return connections?.some((c) => c.provider === provider) ?? false;
}

export function useGoogleConnectionId() {
  const { data: connections } = useConnections();
  return connections?.find((c) => c.provider === "google")?.id ?? null;
}
