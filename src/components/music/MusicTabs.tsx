import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Youtube, Headphones } from "lucide-react";
import { LocalMusicUpload } from "./LocalMusicUpload";
import { YouTubeMusicPlayer } from "./YouTubeMusicPlayer";
import { JamendoExplorer } from "./JamendoExplorer";
import { MusicPlayer } from "./MusicPlayer";
import { useLocalMusic } from "@/hooks/useLocalMusic";
import { useYouTubeMusic } from "@/hooks/useYouTubeMusic";
import { useJamendo } from "@/hooks/useJamendo";

export function MusicTabs() {
  const localMusic = useLocalMusic();
  const youtubeMusic = useYouTubeMusic();
  const jamendo = useJamendo();

  // Determine which player should be active
  const activeLocalTrack = localMusic.currentTrack;
  const activeJamendoTrack = jamendo.currentTrack;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="jamendo" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="jamendo" className="gap-2">
            <Headphones className="w-4 h-4" />
            <span className="hidden sm:inline">Free Music</span>
          </TabsTrigger>
          <TabsTrigger value="local" className="gap-2">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Your Files</span>
          </TabsTrigger>
          <TabsTrigger value="youtube" className="gap-2">
            <Youtube className="w-4 h-4" />
            <span className="hidden sm:inline">YouTube</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jamendo" className="mt-4">
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
        </TabsContent>

        <TabsContent value="local" className="mt-4">
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
        </TabsContent>

        <TabsContent value="youtube" className="mt-4">
          <YouTubeMusicPlayer
            tracks={youtubeMusic.tracks}
            currentTrack={youtubeMusic.currentTrack}
            isPlaying={youtubeMusic.isPlaying}
            onAddTrack={youtubeMusic.addTrack}
            onRemoveTrack={youtubeMusic.removeTrack}
            onPlayTrack={youtubeMusic.playTrack}
            onStopTrack={youtubeMusic.stopTrack}
          />
        </TabsContent>
      </Tabs>

      {/* Hidden audio elements */}
      <audio ref={localMusic.audioRef} className="hidden" />
      <audio ref={jamendo.audioRef} className="hidden" />

      {/* Global Player - Local Music */}
      {activeLocalTrack && (
        <MusicPlayer
          currentTrack={{
            title: activeLocalTrack.title,
            artist: activeLocalTrack.artist,
            coverArt: activeLocalTrack.coverArt,
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
          ref={localMusic.audioRef}
        />
      )}

      {/* Global Player - Jamendo */}
      {activeJamendoTrack && !activeLocalTrack && (
        <MusicPlayer
          currentTrack={{
            title: activeJamendoTrack.name,
            artist: activeJamendoTrack.artist_name,
            image: activeJamendoTrack.image,
          }}
          isPlaying={jamendo.isPlaying}
          currentTime={jamendo.currentTime}
          duration={jamendo.duration}
          onPlayPause={jamendo.togglePlay}
          onSeek={jamendo.seek}
          ref={jamendo.audioRef}
        />
      )}
    </div>
  );
}
