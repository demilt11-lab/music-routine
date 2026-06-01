import {
  forwardRef,
  lazy,
  memo,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Headphones, Music, Upload, Youtube } from "lucide-react";
import { MusicPlayer } from "./MusicPlayer";
import { useLocalMusic } from "@/hooks/useLocalMusic";
import { useYouTubeMusic } from "@/hooks/useYouTubeMusic";
import { useJamendo } from "@/hooks/useJamendo";
import { useSpotify, type SpotifyTrack } from "@/hooks/useSpotify";
import { toast } from "sonner";

const LocalMusicUpload = lazy(() =>
  import("./LocalMusicUpload").then((m) => ({ default: m.LocalMusicUpload }))
);
const YouTubeMusicPlayer = lazy(() =>
  import("./YouTubeMusicPlayer").then((m) => ({ default: m.YouTubeMusicPlayer }))
);
const JamendoExplorer = lazy(() =>
  import("./JamendoExplorer").then((m) => ({ default: m.JamendoExplorer }))
);
const SpotifyPlayer = lazy(() =>
  import("./SpotifyPlayer").then((m) => ({ default: m.SpotifyPlayer }))
);

type MusicTabValue = "spotify" | "jamendo" | "local" | "youtube";

const tabConfig: {
  value: MusicTabValue;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "spotify", label: "Spotify", shortLabel: "Spotify", icon: Music },
  { value: "jamendo", label: "Free Music", shortLabel: "Free", icon: Headphones },
  { value: "local", label: "Your Files", shortLabel: "Files", icon: Upload },
  { value: "youtube", label: "YouTube", shortLabel: "YouTube", icon: Youtube },
];

const TabFallback = memo(function TabFallback() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
      Loading player...
    </div>
  );
});

const MusicTabsInner = forwardRef<HTMLDivElement>(function MusicTabsInner(_, ref) {
  const [activeTab, setActiveTab] = useState<MusicTabValue>("spotify");

  const localMusic = useLocalMusic();
  const youtubeMusic = useYouTubeMusic();
  const jamendo = useJamendo();

  const handleTrackPlay = useCallback((track: SpotifyTrack) => {
    toast.success(`Now playing: ${track.name}`, {
      description: "Adaptive music engine will curate your playlist based on biometrics.",
      duration: 3000,
    });

    window.dispatchEvent(
      new CustomEvent("spotify-track-play", {
        detail: {
          title: track.name,
          artist: track.artist,
          uri: track.uri,
          id: track.id,
        },
      })
    );
  }, []);

  const spotify = useSpotify(handleTrackPlay);

  const activePlayer = useMemo(() => {
    if (spotify.currentTrack) {
      return (
        <MusicPlayer
          currentTrack={{
            title: spotify.currentTrack.name,
            artist: spotify.currentTrack.artist,
            image: spotify.currentTrack.image,
          }}
          isPlaying={spotify.isPlaying}
          currentTime={spotify.currentTime}
          duration={spotify.duration}
          onPlayPause={spotify.togglePlay}
          onSeek={spotify.seek}
        />
      );
    }

    if (localMusic.currentTrack) {
      return (
        <MusicPlayer
          ref={localMusic.audioRef}
          currentTrack={{
            title: localMusic.currentTrack.title,
            artist: localMusic.currentTrack.artist,
            coverArt: localMusic.currentTrack.coverArt,
          }}
          isPlaying={localMusic.isPlaying}
          currentTime={localMusic.currentTime}
          duration={localMusic.duration}
          volume={localMusic.volume}
          onPlayPause={localMusic.togglePlay}
          onSeek={localMusic.seek}
          onVolumeChange={localMusic.setVolume}
          onPrevious={localMusic.previous}
          onNext={localMusic.next}
        />
      );
    }

    if (jamendo.currentTrack) {
      return (
        <MusicPlayer
          ref={jamendo.audioRef}
          currentTrack={{
            title: jamendo.currentTrack.name,
            artist: jamendo.currentTrack.artist_name,
            image: jamendo.currentTrack.image,
          }}
          isPlaying={jamendo.isPlaying}
          currentTime={jamendo.currentTime}
          duration={jamendo.duration}
          onPlayPause={jamendo.togglePlay}
          onSeek={jamendo.seek}
        />
      );
    }

    return null;
  }, [
    jamendo.audioRef,
    jamendo.currentTime,
    jamendo.currentTrack,
    jamendo.duration,
    jamendo.isPlaying,
    jamendo.seek,
    jamendo.togglePlay,
    localMusic.audioRef,
    localMusic.currentTime,
    localMusic.currentTrack,
    localMusic.duration,
    localMusic.isPlaying,
    localMusic.next,
    localMusic.previous,
    localMusic.seek,
    localMusic.setVolume,
    localMusic.togglePlay,
    localMusic.volume,
    spotify.currentTime,
    spotify.currentTrack,
    spotify.duration,
    spotify.isPlaying,
    spotify.seek,
    spotify.togglePlay,
  ]);

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as MusicTabValue);
  }, []);

  return (
    <div ref={ref} className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {tabConfig.map(({ value, label, shortLabel, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-2">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="spotify" forceMount={activeTab === "spotify"} className="mt-4">
          {activeTab === "spotify" ? (
            <Suspense fallback={<TabFallback />}>
              <SpotifyPlayer
                isConnected={spotify.isConnected}
                isLoading={spotify.isLoading}
                tracks={spotify.tracks}
                currentTrack={spotify.currentTrack}
                isPlaying={spotify.isPlaying}
                sdkReady={spotify.sdkReady}
                isPremium={spotify.isPremium}
                onConnect={spotify.connect}
                onDisconnect={spotify.disconnect}
                onSearch={spotify.search}
                onPlay={spotify.play}
                onPause={spotify.pause}
              />
            </Suspense>
          ) : null}
        </TabsContent>

        <TabsContent value="jamendo" forceMount={activeTab === "jamendo"} className="mt-4">
          {activeTab === "jamendo" ? (
            <Suspense fallback={<TabFallback />}>
              <JamendoExplorer
                tracks={jamendo.tracks}
                featuredTracks={jamendo.featuredTracks}
                currentTrack={jamendo.currentTrack}
                isPlaying={jamendo.isPlaying}
                isLoading={jamendo.isLoading}
                error={jamendo.error}
                onSearch={jamendo.search}
                onLoadFeatured={jamendo.loadFeatured}
                onLoadByMood={jamendo.loadByMood}
                onPlay={jamendo.play}
                onPause={jamendo.pause}
              />
            </Suspense>
          ) : null}
        </TabsContent>

        <TabsContent value="local" forceMount={activeTab === "local"} className="mt-4">
          {activeTab === "local" ? (
            <Suspense fallback={<TabFallback />}>
              <LocalMusicUpload
                tracks={localMusic.tracks}
                currentTrack={localMusic.currentTrack}
                isPlaying={localMusic.isPlaying}
                isLoading={localMusic.isLoading}
                onAddTracks={localMusic.addTracks}
                onRemoveTrack={localMusic.removeTrack}
                onPlay={localMusic.play}
                onPause={localMusic.pause}
              />
            </Suspense>
          ) : null}
        </TabsContent>

        <TabsContent value="youtube" forceMount={activeTab === "youtube"} className="mt-4">
          {activeTab === "youtube" ? (
            <Suspense fallback={<TabFallback />}>
              <YouTubeMusicPlayer
                tracks={youtubeMusic.tracks}
                currentTrack={youtubeMusic.currentTrack}
                isPlaying={youtubeMusic.isPlaying}
                onAddTrack={youtubeMusic.addTrack}
                onRemoveTrack={youtubeMusic.removeTrack}
                onPlayTrack={youtubeMusic.playTrack}
                onStopTrack={youtubeMusic.stopTrack}
              />
            </Suspense>
          ) : null}
        </TabsContent>
      </Tabs>

      <audio ref={localMusic.audioRef} className="hidden" preload="none" />
      <audio ref={jamendo.audioRef} className="hidden" preload="none" />
      <audio ref={spotify.audioRef} className="hidden" preload="none" />

      {activePlayer}
    </div>
  );
});

MusicTabsInner.displayName = "MusicTabs";

export const MusicTabs = memo(MusicTabsInner);
