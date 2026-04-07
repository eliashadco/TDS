import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <main className="space-y-4 p-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}
