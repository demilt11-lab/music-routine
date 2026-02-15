import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Music, Search, Play, Pause, LogIn, LogOut, Loader2, Headphones,
} from "lucide-react";
import { type SpotifyTrack } from "@/hooks/useSpotify";

interface SpotifyPlayerProps {
  isConnected: boolean;
  isLoading: boolean;
  tracks: SpotifyTrack[];
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  sdkReady?: boolean;
  isPremium?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSearch: (query: string) => void;
  onPlay: (track: SpotifyTrack) => void;
  onPause: () => void;
}

export function SpotifyPlayer({
  isConnected,
  isLoading,
  tracks,
  currentTrack,
  isPlaying,
  sdkReady = false,
  isPremium = true,
  onConnect,
  onDisconnect,
  onSearch,
  onPlay,
  onPause,
}: SpotifyPlayerProps) {
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  if (!isConnected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-[#1DB954]" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Connect Spotify</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Link your Spotify account to search and play millions of tracks during your sessions.
          </p>
          <Button onClick={onConnect} disabled={isLoading} className="bg-[#1DB954] hover:bg-[#1ed760] text-white">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
            Connect Spotify
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#1DB954] text-[#1DB954]">
            <span className="w-2 h-2 rounded-full bg-[#1DB954] mr-1.5 inline-block" />
            Spotify Connected
          </Badge>
          {sdkReady && (
            <Badge variant="secondary" className="text-xs">
              <Headphones className="w-3 h-3 mr-1" />
              Full Playback
            </Badge>
          )}
          {!isPremium && !sdkReady && (
            <Badge variant="secondary" className="text-xs">
              Preview Mode
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onDisconnect}>
          <LogOut className="w-4 h-4 mr-1" /> Disconnect
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Search Spotify tracks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !query.trim()}>
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </form>

      {tracks.length > 0 && (
        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {tracks.map((track) => {
              const isActive = currentTrack?.id === track.id;
              const canPlay = sdkReady || track.preview_url;
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? "bg-primary/10" : "hover:bg-secondary/50"
                  } ${!canPlay ? "opacity-50" : ""}`}
                  onClick={() => {
                    if (!canPlay) return;
                    isActive && isPlaying ? onPause() : onPlay(track);
                  }}
                >
                  <div className="relative w-10 h-10 rounded shrink-0 overflow-hidden bg-secondary">
                    {track.image ? (
                      <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {isActive && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{track.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
                  </div>
                  {!canPlay && (
                    <span className="text-[10px] text-muted-foreground shrink-0">Premium only</span>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {tracks.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Search for tracks to get started
        </div>
      )}
    </div>
  );
}
