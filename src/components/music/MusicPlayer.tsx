import { useRef, useEffect, forwardRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Music
} from "lucide-react";

interface MusicPlayerProps {
  currentTrack: {
    title: string;
    artist: string;
    coverArt?: string;
    image?: string;
  } | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume?: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  showControls?: boolean;
  minimal?: boolean;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const MusicPlayer = forwardRef<HTMLAudioElement, MusicPlayerProps>(
  (
    {
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume = 1,
      onPlayPause,
      onSeek,
      onVolumeChange,
      onPrevious,
      onNext,
      showControls = true,
      minimal = false,
    },
    ref
  ) => {
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const audioRef = (ref as React.RefObject<HTMLAudioElement>) || localAudioRef;

    if (!currentTrack && !minimal) {
      return null;
    }

    const coverImage = currentTrack?.coverArt || currentTrack?.image;

    if (minimal) {
      return (
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
          <audio ref={audioRef} className="hidden" />
          
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {coverImage ? (
              <img 
                src={coverImage} 
                alt={currentTrack?.title || "No track"} 
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <Music className="w-5 h-5 text-primary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">
              {currentTrack?.title || "No track selected"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {currentTrack?.artist || "Select a track to play"}
            </p>
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={onPlayPause}
            disabled={!currentTrack}
            className="shrink-0"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>
      );
    }

    return (
      <Card className="fixed bottom-0 left-0 right-0 z-50 rounded-none border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="p-4">
          <audio ref={audioRef} className="hidden" />
          
          <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {coverImage ? (
                  <img 
                    src={coverImage} 
                    alt={currentTrack.title} 
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Music className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{currentTrack.title}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            {/* Playback Controls */}
            {showControls && (
              <div className="flex flex-col items-center gap-2 flex-1 max-w-md">
                <div className="flex items-center gap-2">
                  {onPrevious && (
                    <Button size="icon" variant="ghost" onClick={onPrevious}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                  )}
                  <Button 
                    size="icon" 
                    className="rounded-full w-10 h-10"
                    onClick={onPlayPause}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </Button>
                  {onNext && (
                    <Button size="icon" variant="ghost" onClick={onNext}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 w-full">
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {formatTime(currentTime)}
                  </span>
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={1}
                    onValueChange={([value]) => onSeek(value)}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-10">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            )}

            {/* Volume Control */}
            {onVolumeChange && (
              <div className="flex items-center gap-2 flex-1 justify-end max-w-[150px]">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
                >
                  {volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                <Slider
                  value={[volume]}
                  max={1}
                  step={0.01}
                  onValueChange={([value]) => onVolumeChange(value)}
                  className="w-20"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

MusicPlayer.displayName = "MusicPlayer";
