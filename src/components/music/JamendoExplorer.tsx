import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Headphones, Search, Play, Pause, Loader2, Music,
  ExternalLink
} from "lucide-react";
import type { JamendoTrack } from "@/hooks/useJamendo";

interface JamendoExplorerProps {
  tracks: JamendoTrack[];
  featuredTracks: JamendoTrack[];
  currentTrack: JamendoTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  onSearch: (params: { search?: string; tags?: string }) => Promise<void>;
  onLoadFeatured: () => Promise<void>;
  onLoadByMood: (mood: string) => Promise<void>;
  onPlay: (track: JamendoTrack) => void;
  onPause: () => void;
}

const moodTags = [
  { label: "Chill", value: "chillout", color: "bg-blue-500/10 text-blue-600" },
  { label: "Energetic", value: "energetic", color: "bg-orange-500/10 text-orange-600" },
  { label: "Focus", value: "study", color: "bg-purple-500/10 text-purple-600" },
  { label: "Relaxing", value: "relax", color: "bg-green-500/10 text-green-600" },
  { label: "Workout", value: "workout", color: "bg-red-500/10 text-red-600" },
  { label: "Sleep", value: "sleep", color: "bg-indigo-500/10 text-indigo-600" },
];

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function JamendoExplorer({
  tracks,
  featuredTracks,
  currentTrack,
  isPlaying,
  isLoading,
  error,
  onSearch,
  onLoadFeatured,
  onLoadByMood,
  onPlay,
  onPause,
}: JamendoExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMood, setActiveMood] = useState<string | null>(null);

  useEffect(() => {
    onLoadFeatured();
  }, [onLoadFeatured]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveMood(null);
      onSearch({ search: searchQuery });
    }
  };

  const handleMoodClick = (mood: string) => {
    setSearchQuery("");
    setActiveMood(mood);
    onLoadByMood(mood);
  };

  const displayTracks = tracks.length > 0 ? tracks : featuredTracks;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headphones className="w-5 h-5 text-accent" />
          Free Music (Jamendo)
        </CardTitle>
        <CardDescription>
          Discover royalty-free Creative Commons music
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search free music..."
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Mood Tags */}
        <div className="flex flex-wrap gap-2">
          {moodTags.map((tag) => (
            <Badge
              key={tag.value}
              variant="secondary"
              className={`cursor-pointer transition-all ${
                activeMood === tag.value 
                  ? "bg-primary text-primary-foreground" 
                  : tag.color + " hover:opacity-80"
              }`}
              onClick={() => handleMoodClick(tag.value)}
            >
              {tag.label}
            </Badge>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="text-center py-4 text-destructive">
            <p>{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading tracks...</span>
          </div>
        )}

        {/* Track Grid */}
        {!isLoading && displayTracks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
            {displayTracks.map((track) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const isTrackPlaying = isCurrentTrack && isPlaying;

              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
                    isCurrentTrack 
                      ? "bg-accent/10 border border-accent/20" 
                      : "bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={track.image || "/placeholder.svg"}
                      alt={track.name}
                      className="w-12 h-12 rounded object-cover"
                    />
                    <Button
                      size="icon"
                      variant={isTrackPlaying ? "default" : "secondary"}
                      className="absolute inset-0 w-12 h-12 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        if (isTrackPlaying) {
                          onPause();
                        } else {
                          onPlay(track);
                        }
                      }}
                    >
                      {isTrackPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 ml-0.5" />
                      )}
                    </Button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {track.artist_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDuration(track.duration)}
                    </p>
                  </div>

                  <a
                    href={track.license_ccurl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && displayTracks.length === 0 && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tracks found</p>
            <p className="text-sm">Try a different search or mood</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
