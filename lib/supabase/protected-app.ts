import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TradeMode } from "@/types/trade";

type ProtectedAppProfile = {
  id: string;
  mode: TradeMode | null;
  learnMode: boolean;
  equity: number;
};

type ProtectedAppContext = {
  userId: string;
  profile: ProtectedAppProfile;
};

export const getProtectedAppContext = cache(async (): Promise<ProtectedAppContext> => {
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("mode, learn_mode, equity")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    profile: {
      id: user.id,
      mode: profileData?.mode ?? null,
      learnMode: Boolean(profileData?.learn_mode ?? false),
      equity: Number(profileData?.equity ?? 100000),
    },
  };
});