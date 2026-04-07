import { Skeleton } from "@/components/ui/skeleton";

export default function AppSectionLoading() {
  return (
    <main className="space-y-4 p-4 md:p-6">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </main>
  );
}
