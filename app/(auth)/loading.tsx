import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-tds-border bg-tds-card p-6">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </main>
  );
}
