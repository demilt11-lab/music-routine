import { useState, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus, Moon, Dumbbell, BookOpen, Coffee, Car, Music, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActivityTypes, useCurrentUser } from "@/hooks/useDashboardData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const activityIcons: Record<string, React.ReactNode> = {
  sleep: <Moon className="w-4 h-4" />,
  workout: <Dumbbell className="w-4 h-4" />,
  study: <BookOpen className="w-4 h-4" />,
  relax: <Coffee className="w-4 h-4" />,
  commute: <Car className="w-4 h-4" />,
};

export const QuickLogButton = forwardRef<HTMLDivElement>((_, ref) => {
  const [isLogging, setIsLogging] = useState(false);
  const { data: user } = useCurrentUser();
  const { data: activityTypes = [] } = useActivityTypes();
  const queryClient = useQueryClient();

  const handleQuickLog = async (activityId: string, activityName: string) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    setIsLogging(true);
    try {
      const now = new Date();
      const ended = new Date(now.getTime() + 30 * 60 * 1000); // Default 30 min session

      const { error } = await supabase.from("listening_sessions").insert({
        user_id: user.id,
        activity_type_id: activityId,
        name: `Quick ${activityName} session`,
        started_at: now.toISOString(),
        ended_at: ended.toISOString(),
        mood_before: "neutral",
      });

      if (error) throw error;

      toast.success(`Logged ${activityName} session!`, {
        description: "30-minute session added to your history",
      });
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    } catch (err) {
      toast.error("Failed to log session");
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-14 w-14 rounded-full shadow-lg"
          disabled={isLogging}
        >
          {isLogging ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-48">
        {activityTypes.map((activity) => (
          <DropdownMenuItem
            key={activity.id}
            onClick={() => handleQuickLog(activity.id, activity.name)}
            className="gap-2 capitalize cursor-pointer"
          >
            {activityIcons[activity.name] || <Music className="w-4 h-4" />}
            {activity.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

QuickLogButton.displayName = "QuickLogButton";
