import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const DashboardSkeleton = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-24 h-5" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-20 h-8" />
          <Skeleton className="w-20 h-8" />
          <Skeleton className="w-20 h-8" />
        </div>
      </div>
    </header>
    <main className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* Quick stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-8 rounded-full mb-3" />
              <Skeleton className="h-7 w-12 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Section skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
          <CardContent><Skeleton className="h-32 w-full" /></CardContent>
        </Card>
      ))}
    </main>
  </div>
);
