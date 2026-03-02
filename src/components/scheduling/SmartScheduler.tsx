import React, { forwardRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  Clock, 
  Sparkles, 
  TrendingUp, 
  Zap,
  ChevronRight,
  Target,
  Brain,
  RefreshCw,
  CalendarDays,
  Timer
} from "lucide-react";
import { useSmartScheduling } from "@/hooks/useSmartScheduling";
import { format, isToday, isTomorrow, formatDistanceToNow } from "date-fns";

const formatHour = (hour: number) => {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return "text-green-500";
  if (confidence >= 60) return "text-yellow-500";
  return "text-muted-foreground";
};

const getConfidenceBg = (confidence: number) => {
  if (confidence >= 80) return "bg-green-500/10 border-green-500/30";
  if (confidence >= 60) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-muted/50";
};

export const SmartScheduler = forwardRef<HTMLDivElement>((_, ref) => {
  const { data, isLoading, error, refresh } = useSmartScheduling();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Smart Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Smart Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Unable to generate scheduling suggestions. Start more sessions to build patterns.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { suggestions, activityWindows, nextOptimalSlot, weeklySchedule } = data;

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Smart Scheduling
          </CardTitle>
          <CardDescription>
            AI-powered session timing recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Complete more sessions to unlock personalized scheduling suggestions.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Smart Scheduling
            </CardTitle>
            <CardDescription>
              AI-powered optimal session timing based on your patterns
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Next Optimal Slot Highlight */}
        {nextOptimalSlot && (
          <div className={`p-4 rounded-lg border-2 ${getConfidenceBg(nextOptimalSlot.confidence)}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
                  {nextOptimalSlot.activityIcon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{nextOptimalSlot.activityName}</span>
                    <Badge variant="outline" className={getConfidenceColor(nextOptimalSlot.confidence)}>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {nextOptimalSlot.confidence}% match
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {isToday(nextOptimalSlot.suggestedDate) 
                      ? `Today at ${formatHour(nextOptimalSlot.suggestedHour)}`
                      : isTomorrow(nextOptimalSlot.suggestedDate)
                        ? `Tomorrow at ${formatHour(nextOptimalSlot.suggestedHour)}`
                        : `${format(nextOptimalSlot.suggestedDate, "EEEE")} at ${formatHour(nextOptimalSlot.suggestedHour)}`
                    }
                    <span className="text-muted-foreground/70">
                      ({formatDistanceToNow(nextOptimalSlot.suggestedDate, { addSuffix: true })})
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {nextOptimalSlot.historicalFlowScore}% flow
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  ~{nextOptimalSlot.expectedDuration}min
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3 pl-15">
              {nextOptimalSlot.reasoning}
            </p>
          </div>
        )}

        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="weekly">Weekly View</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3 pr-4">
                {suggestions.map((suggestion) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="weekly" className="mt-4">
            <WeeklyScheduleView schedule={weeklySchedule} />
          </TabsContent>

          <TabsContent value="patterns" className="mt-4">
            <ActivityPatternsView activityWindows={activityWindows} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});

const SuggestionCard = React.forwardRef<HTMLDivElement, { suggestion: any }>(
  ({ suggestion, ...props }, ref) => {
    return (
      <div ref={ref} {...props} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
            {suggestion.activityIcon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{suggestion.activityName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {format(suggestion.suggestedDate, "EEE, MMM d")}
              <Clock className="h-3 w-3 ml-1" />
              {formatHour(suggestion.suggestedHour)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className={`text-sm font-medium ${getConfidenceColor(suggestion.confidence)}`}>
              {suggestion.confidence}%
            </div>
            <div className="text-xs text-muted-foreground">confidence</div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }
);
SuggestionCard.displayName = "SuggestionCard";

function WeeklyScheduleView({ schedule }: { schedule: { day: string; slots: any[] }[] }) {
  const today = new Date().getDay();
  const dayAbbreviations: { [key: string]: string } = {
    Sunday: "Sun",
    Monday: "Mon",
    Tuesday: "Tue",
    Wednesday: "Wed",
    Thursday: "Thu",
    Friday: "Fri",
    Saturday: "Sat",
  };

  return (
    <div className="space-y-2">
      {schedule.map((day, index) => (
        <div 
          key={day.day} 
          className={`p-3 rounded-lg border ${
            index === today ? "border-primary bg-primary/5" : "bg-card"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${index === today ? "text-primary" : ""}`}>
                {dayAbbreviations[day.day]}
              </span>
              {index === today && (
                <Badge variant="secondary" className="text-xs">Today</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {day.slots.length === 0 ? (
                <span className="text-xs text-muted-foreground">No suggestions</span>
              ) : (
                <ScrollArea className="w-[200px]">
                  <div className="flex gap-2">
                    {day.slots.map((slot) => (
                      <Badge 
                        key={slot.id} 
                        variant="outline" 
                        className="shrink-0 text-xs"
                      >
                        <span className="mr-1">{slot.activityIcon}</span>
                        {formatHour(slot.suggestedHour)}
                      </Badge>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityPatternsView({ activityWindows }: { activityWindows: any[] }) {
  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-4 pr-4">
        {activityWindows.map((activity) => (
          <div key={activity.activityName} className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                {activity.activityIcon}
              </div>
              <div>
                <span className="font-medium">{activity.activityName}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Target className="h-3 w-3" />
                  {Math.round(activity.successRate * 100)}% flow success rate
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Best Days</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activity.bestDays.slice(0, 3).map((day: any) => (
                    <Badge key={day.day} variant="secondary" className="text-xs">
                      {day.day.slice(0, 3)}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Best Hours</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {activity.bestHours.slice(0, 3).map((hour: any) => (
                    <Badge key={hour.hour} variant="secondary" className="text-xs">
                      {formatHour(hour.hour)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Avg Flow Score</span>
                <span>{Math.round(activity.avgFlowScore)}%</span>
              </div>
              <Progress value={activity.avgFlowScore} className="h-1.5" />
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

SmartScheduler.displayName = "SmartScheduler";
