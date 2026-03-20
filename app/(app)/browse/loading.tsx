import { Skeleton } from "@/components/ui/skeleton"

export default function BrowseLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      {/* Search bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md md:h-9 md:w-60" />
      </div>

      {/* Filter controls skeleton */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      {/* Card count skeleton */}
      <Skeleton className="h-4 w-36" />

      {/* Card list skeletons -- mobile */}
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <Skeleton className="mt-0.5 size-4 rounded" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Card list skeletons -- desktop table */}
      <div className="hidden md:block rounded-lg border">
        {/* Header */}
        <div className="flex border-b bg-muted/50 px-3 py-2">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="ml-3 h-4 w-16" />
          <Skeleton className="ml-6 h-4 w-48 flex-1" />
          <Skeleton className="ml-3 h-4 w-12" />
          <Skeleton className="ml-3 h-4 w-20" />
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center border-b px-3 py-3">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="ml-3 h-5 w-20 rounded-full" />
            <Skeleton className="ml-6 h-4 flex-1" />
            <Skeleton className="ml-3 h-4 w-8" />
            <Skeleton className="ml-3 h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
