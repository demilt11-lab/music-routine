import { memo, useCallback, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Headphones,
  Loader2,
  LogIn,
  LogOut,
  Music,
  Pause,
  Play,
  Search,
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
  onSearch: (query: string) => void | Promise<void>;
  onPlay: (track: SpotifyTrack) => void | Promise<void>;
  onPause: () => void | Promise<void>;
}

const EmptyResults = memo(function EmptyResults({
  isConnected,
  hasQuery,
  isLoading,
}: {
  isConnected: boolean;
  hasQuery: boolean;
  isLoading: boolean;
}) {
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Music className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Connect Spotify to search tracks</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use your Spotify account to search and play music
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Searching Spotify...
      </div>
    );
  }

  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">No tracks found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a different artist, song, or keyword
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Headphones className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">Search Spotify to start listening</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Find tracks, preview songs, and connect playback
      </p>
    </div>
  );
});

const CurrentTrackCard = memo(function CurrentTrackCard({
  track,
  isPlaying,
  sdkReady,
  isPremium,
  onPause,
}: {
  track: SpotifyTrack | null;
  isPlaying: boolean;
  sdkReady: boolean;
  isPremium: boolean;
  onPause: () => void | Promise<void>;
}) {
  const handlePause = useCallback(() => {
    void onPause();
  }, [onPause]);

  if (!track) return null;

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-4">
        {track.image ? (
          <img
            src={track.image}
            alt={`${track.name} cover art`}
            className="h-16 w-16 rounded-md object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-muted">
            <Music className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{track.name}</p>
          <p className="truncate text-sm text-muted-foreground">{track.artist}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {sdkReady ? (
              <Badge variant="default">Spotify SDK Ready</Badge>
            ) : (
              <Badge variant="secondary">Preview Mode</Badge>
            )}
            {!isPremium ? <Badge variant="outline">Premium Required</Badge> : null}
          </div>
        </div>

        <Button
          size="icon"
          variant="outline"
          onClick={handlePause}
          aria-label={`Pause ${track.name}`}
          disabled={!isPlaying}
        >
          <Pause className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

const SearchBar = memo(function SearchBar({
  isConnected,
  isLoading,
  query,
  onQueryChange,
  onSearchSubmit,
}: {
  isConnected: boolean;
  isLoading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
}) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        onSearchSubmit();
      }
    },
    [onSearchSubmit]
  );

  return (
    <div className="mb-4 flex gap-2">
      <Input
        placeholder="Search songs, artists, or albums..."
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!isConnected || isLoading}
      />
      <Button onClick={onSearchSubmit} disabled={!isConnected || isLoading || !query.trim()}>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
});

const TrackRow = memo(function TrackRow({
  track,
  isCurrent,
  isPlaying,
  onPlay,
  onPause,
}: {
  track: SpotifyTrack;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: (track: SpotifyTrack) => void | Promise<void>;
  onPause: () => void | Promise<void>;
}) {
  const handleAction = useCallback(() => {
    if (isCurrent && isPlaying) {
      void onPause();
      return;
    }

    void onPlay(track);
  }, [isCurrent, isPlaying, onPause, onPlay, track]);

  return (
    <div className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
      {track.image ? (
        <img
          src={track.image}
          alt={`${track.name} artwork`}
          className="h-12 w-12 rounded object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
          <Music className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{track.name}</p>
        <p className="truncate text-xs text-muted-foreground">{track.artist}</p>
      </div>

      <Button
        size="icon"
        variant={isCurrent ? "default" : "outline"}
        onClick={handleAction}
        aria-label={
          isCurrent && isPlaying ? `Pause ${track.name}` : `Play ${track.name}`
        }
      >
        {isCurrent && isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
});

const TrackResults = memo(function TrackResults({
  tracks,
  currentTrack,
  isPlaying,
  onPlay,
  onPause,
}: {
  tracks: SpotifyTrack[];
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  onPlay: (track: SpotifyTrack) => void | Promise<void>;
  onPause: () => void | Promise<void>;
}) {
  return (
    <ScrollArea className="h-[420px]">
      <div className="space-y-1">
        {tracks.map((track) => {
          const isCurrent = currentTrack?.id === track.id;

          return (
            <TrackRow
              key={track.id}
              track={track}
              isCurrent={isCurrent}
              isPlaying={isCurrent && isPlaying}
              onPlay={onPlay}
              onPause={onPause}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
});

export const SpotifyPlayer = memo(function SpotifyPlayer({
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

  const hasQuery = query.trim().length > 0;

  const sortedTracks = useMemo(() => tracks, [tracks]);

  const handleConnect = useCallback(() => {
    onConnect();
  }, [onConnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect();
  }, [onDisconnect]);

  const handleSearchSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed || isLoading || !isConnected) return;
    void onSearch(trimmed);
  }, [isConnected, isLoading, onSearch, query]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Music className="h-5 w-5 text-primary" />
              Spotify Player
            </h3>
            <p className="text-sm text-muted-foreground">
              Search and play tracks from Spotify
            </p>
          </div>

          {isConnected ? (
            <Button variant="outline" onClick={handleDisconnect}>
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Connect Spotify
            </Button>
          )}
        </div>

        <CurrentTrackCard
          track={currentTrack}
          isPlaying={isPlaying}
          sdkReady={sdkReady}
          isPremium={isPremium}
          onPause={onPause}
        />

        <SearchBar
          isConnected={isConnected}
          isLoading={isLoading}
          query={query}
          onQueryChange={handleQueryChange}
          onSearchSubmit={handleSearchSubmit}
        />

        {sortedTracks.length > 0 ? (
          <TrackResults
            tracks={sortedTracks}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlay={onPlay}
            onPause={onPause}
          />
        ) : (
          <EmptyResults
            isConnected={isConnected}
            hasQuery={hasQuery}
            isLoading={isLoading}
          />
        )}
      </CardContent>
    </Card>
  );
});
