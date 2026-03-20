import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="p-4 md:p-6">
      <Skeleton className="mb-4 h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="mt-6 h-64 rounded-xl" />
    </div>
  );
}
