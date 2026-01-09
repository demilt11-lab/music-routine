import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Youtube, Play, X, Plus, Trash2, Link2
} from "lucide-react";
import { toast } from "sonner";
import type { YouTubeTrack } from "@/hooks/useYouTubeMusic";

interface YouTubeMusicPlayerProps {
  tracks: YouTubeTrack[];
  currentTrack: YouTubeTrack | null;
  isPlaying: boolean;
  onAddTrack: (url: string) => Promise<boolean>;
  onRemoveTrack: (id: string) => void;
  onPlayTrack: (track: YouTubeTrack) => void;
  onStopTrack: () => void;
}

export function YouTubeMusicPlayer({
  tracks,
  currentTrack,
  isPlaying,
  onAddTrack,
  onRemoveTrack,
  onPlayTrack,
  onStopTrack,
}: YouTubeMusicPlayerProps) {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTrack = async () => {
    if (!youtubeUrl.trim()) {
      toast.error("Please enter a YouTube URL");
      return;
    }

    setIsAdding(true);
    const success = await onAddTrack(youtubeUrl);
    
    if (success) {
      toast.success("Track added successfully");
      setYoutubeUrl("");
    } else {
      toast.error("Invalid YouTube URL or track already added");
    }
    setIsAdding(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Youtube className="w-5 h-5 text-destructive" />
          YouTube Music
        </CardTitle>
        <CardDescription>
          Add YouTube videos to your playlist (works with YouTube Music too)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add URL Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Paste YouTube URL..."
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && handleAddTrack()}
            />
          </div>
          <Button onClick={handleAddTrack} disabled={isAdding}>
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Current Playing Video */}
        {currentTrack && isPlaying && (
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
            <iframe
              src={currentTrack.embedUrl}
              title={currentTrack.title}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <Button
              size="icon"
              variant="secondary"
              className="absolute top-2 right-2 z-10"
              onClick={onStopTrack}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Track List */}
        {tracks.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tracks.map((track) => {
              const isCurrentTrack = currentTrack?.id === track.id;

              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
                    isCurrentTrack && isPlaying
                      ? "bg-destructive/10 border border-destructive/20" 
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <Button
                    size="icon"
                    variant={isCurrentTrack && isPlaying ? "destructive" : "ghost"}
                    className="shrink-0 w-9 h-9"
                    onClick={() => {
                      if (isCurrentTrack && isPlaying) {
                        onStopTrack();
                      } else {
                        onPlayTrack(track);
                      }
                    }}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </Button>

                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-12 h-9 rounded object-cover shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {track.artist}
                    </p>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemoveTrack(track.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {tracks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Youtube className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No YouTube tracks added</p>
            <p className="text-sm">Paste a YouTube URL above to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
