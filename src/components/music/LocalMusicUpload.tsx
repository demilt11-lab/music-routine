import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Music, Play, Pause, Trash2, Loader2 } from "lucide-react";
import type { LocalTrack } from "@/hooks/useLocalMusic";

interface LocalMusicUploadProps {
  tracks: LocalTrack[];
  currentTrack: LocalTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  onAddTracks: (files: FileList) => Promise<void>;
  onRemoveTrack: (id: string) => void;
  onPlay: (track: LocalTrack) => void;
  onPause: () => void;
}

const formatDuration = (seconds: number): string => {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function LocalMusicUpload({
  tracks,
  currentTrack,
  isPlaying,
  isLoading,
  onAddTracks,
  onRemoveTrack,
  onPlay,
  onPause,
}: LocalMusicUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddTracks(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      onAddTracks(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-primary" />
          Your Music Library
        </CardTitle>
        <CardDescription>
          Upload your own audio files (MP3, WAV, FLAC, M4A, OGG)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Drop audio files here</p>
          <p className="text-sm text-muted-foreground">or click to browse</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Processing files...</span>
          </div>
        )}

        {/* Track List */}
        {tracks.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {tracks.map((track) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const isTrackPlaying = isCurrentTrack && isPlaying;

              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors group ${
                    isCurrentTrack 
                      ? "bg-primary/10 border border-primary/20" 
                      : "hover:bg-secondary/50"
                  }`}
                >
                  <Button
                    size="icon"
                    variant={isTrackPlaying ? "default" : "ghost"}
                    className="shrink-0 w-9 h-9"
                    onClick={() => {
                      if (isTrackPlaying) {
                        onPause();
                      } else {
                        onPlay(track);
                      }
                    }}
                  >
                    {isTrackPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </Button>

                  <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {track.artist}
                    </p>
                  </div>

                  <span className="text-sm text-muted-foreground shrink-0">
                    {formatDuration(track.duration)}
                  </span>

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
        {tracks.length === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No tracks uploaded yet</p>
            <p className="text-sm">Your uploaded music will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
