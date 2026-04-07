import AppShell from "@/components/layout/AppShell";
import { getProtectedAppContext } from "@/lib/supabase/protected-app";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getProtectedAppContext();

  return <AppShell profile={profile}>{children}</AppShell>;
}