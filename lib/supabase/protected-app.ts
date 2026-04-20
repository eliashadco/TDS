import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import type { TradeMode } from "@/types/trade";

type ProtectedAppProfile = {
  id: string;
  mode: TradeMode | null;
  learnMode: boolean;
  equity: number;
  disciplineProfile: string;
};

type ProtectedAppContext = {
  userId: string;
  profile: ProtectedAppProfile;
};

type ProfileRow = {
  mode: TradeMode | null;
  learn_mode: boolean | null;
  equity: number | string | null;
  discipline_profile?: string | null;
};

function isMissingDisciplineProfileColumn(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && (error.message ?? "").includes("discipline_profile");
}

export async function getProtectedAppContext(): Promise<ProtectedAppContext> {
  noStore();

  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let supportsDisciplineProfile = true;

  const readProfile = async () => {
    const columns = supportsDisciplineProfile
      ? "mode, learn_mode, equity, discipline_profile"
      : "mode, learn_mode, equity";

    const result = await supabase
      .from("profiles")
      .select(columns)
      .eq("id", user.id)
      .maybeSingle();

    if (supportsDisciplineProfile && isMissingDisciplineProfileColumn(result.error)) {
      supportsDisciplineProfile = false;
      return supabase
        .from("profiles")
        .select("mode, learn_mode, equity")
        .eq("id", user.id)
        .maybeSingle();
    }

    return result;
  };

  let { data: profileData } = (await readProfile()) as { data: ProfileRow | null };

  if (!profileData) {
    await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
        },
        { onConflict: "id" },
      );

    ({ data: profileData } = (await readProfile()) as { data: ProfileRow | null });
  }

  return {
    userId: user.id,
    profile: {
      id: user.id,
      mode: profileData?.mode ?? null,
      learnMode: Boolean(profileData?.learn_mode ?? false),
      equity: Number(profileData?.equity ?? 100000),
      disciplineProfile: (profileData?.discipline_profile as string) ?? "balanced",
    },
  };
}