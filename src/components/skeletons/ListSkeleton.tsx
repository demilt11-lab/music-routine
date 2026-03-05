import { Skeleton } from "@/components/ui/skeleton";

export const ListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    ))}
  </div>
);

export const ChartSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border">
          <Skeleton className="h-6 w-6 rounded-full mb-2" />
          <Skeleton className="h-7 w-16 mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="border rounded-lg p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </div>
      <div className="border rounded-lg p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-[250px] w-full" />
      </div>
    </div>
  </div>
);
