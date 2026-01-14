import { useState, useEffect } from "react";
import { Search, Music, Zap, Play, Pause, Filter, Target, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { useJamendo, JamendoTrack } from "@/hooks/useJamendo";
import { cn } from "@/lib/utils";

interface FilteredMusicSearchProps {
  recommendedTempo?: number;
  recommendedEnergy?: number;
  onTrackSelect?: (track: JamendoTrack) => void;
  currentTrack?: JamendoTrack | null;
  isPlaying?: boolean;
  onPlay?: (track: JamendoTrack) => void;
  onPause?: () => void;
}

export function FilteredMusicSearch({
  recommendedTempo = 100,
  recommendedEnergy = 0.5,
  onTrackSelect,
  currentTrack,
  isPlaying = false,
  onPlay,
  onPause,
}: FilteredMusicSearchProps) {
  const [tempoRange, setTempoRange] = useState<[number, number]>([
    Math.max(60, recommendedTempo - 20),
    Math.min(180, recommendedTempo + 20),
  ]);
  const [energyRange, setEnergyRange] = useState<[number, number]>([
    Math.max(0, recommendedEnergy - 0.2),
    Math.min(1, recommendedEnergy + 0.2),
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTracks, setFilteredTracks] = useState<JamendoTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const jamendo = useJamendo();

  // Update ranges when recommendations change
  useEffect(() => {
    setTempoRange([
      Math.max(60, recommendedTempo - 20),
      Math.min(180, recommendedTempo + 20),
    ]);
    setEnergyRange([
      Math.max(0, recommendedEnergy - 0.2),
      Math.min(1, recommendedEnergy + 0.2),
    ]);
  }, [recommendedTempo, recommendedEnergy]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      // Map tempo range to Jamendo speed
      const avgTempo = (tempoRange[0] + tempoRange[1]) / 2;
      const avgEnergy = (energyRange[0] + energyRange[1]) / 2;

      const tracks = await jamendo.searchByTempoEnergy(avgTempo, avgEnergy);
      setFilteredTracks(tracks);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyRecommended = () => {
    setTempoRange([
      Math.max(60, recommendedTempo - 20),
      Math.min(180, recommendedTempo + 20),
    ]);
    setEnergyRange([
      Math.max(0, recommendedEnergy - 0.2),
      Math.min(1, recommendedEnergy + 0.2),
    ]);
  };

  const handlePlayPause = (track: JamendoTrack) => {
    if (currentTrack?.id === track.id && isPlaying) {
      onPause?.();
    } else {
      onPlay?.(track);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Flow-Optimized Music Search
        </CardTitle>
        <CardDescription>
          Find music matching your recommended tempo and energy for optimal flow state
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Recommended Values Display */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <Target className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">AI Recommended</p>
            <p className="text-xs text-muted-foreground">
              {recommendedTempo} BPM • {Math.round(recommendedEnergy * 100)}% Energy
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleApplyRecommended}>
            Apply
          </Button>
        </div>

        {/* Filter Toggle */}
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowFilters(!showFilters)}
        >
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter Settings
          </span>
          <Badge variant="secondary">
            {tempoRange[0]}-{tempoRange[1]} BPM • {Math.round(energyRange[0] * 100)}-{Math.round(energyRange[1] * 100)}% Energy
          </Badge>
        </Button>

        {/* Expandable Filters */}
        {showFilters && (
          <div className="space-y-6 p-4 rounded-lg border bg-muted/30">
            {/* Tempo Range */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  Tempo Range (BPM)
                </Label>
                <span className="text-sm font-medium">
                  {tempoRange[0]} - {tempoRange[1]}
                </span>
              </div>
              <div className="px-2">
                <Slider
                  value={tempoRange}
                  min={60}
                  max={180}
                  step={5}
                  onValueChange={(value) => setTempoRange(value as [number, number])}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>60 (Calm)</span>
                <span>120 (Moderate)</span>
                <span>180 (Fast)</span>
              </div>
            </div>

            {/* Energy Range */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Energy Range
                </Label>
                <span className="text-sm font-medium">
                  {Math.round(energyRange[0] * 100)}% - {Math.round(energyRange[1] * 100)}%
                </span>
              </div>
              <div className="px-2">
                <Slider
                  value={[energyRange[0] * 100, energyRange[1] * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(value) => setEnergyRange([value[0] / 100, value[1] / 100])}
                  className="w-full"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0% (Calm)</span>
                <span>50% (Balanced)</span>
                <span>100% (Intense)</span>
              </div>
            </div>
          </div>
        )}

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="w-full"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Search Flow-Optimized Tracks
        </Button>

        {/* Results */}
        {filteredTracks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Found {filteredTracks.length} tracks</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSearch}
                disabled={isSearching}
              >
                <RefreshCw className={cn("w-4 h-4", isSearching && "animate-spin")} />
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer",
                    currentTrack?.id === track.id
                      ? "border-primary bg-primary/10"
                      : "hover:border-primary/50 hover:bg-muted/50"
                  )}
                  onClick={() => onTrackSelect?.(track)}
                >
                  <div className="flex items-start gap-3">
                    {/* Album Art */}
                    <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={track.image}
                        alt={track.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayPause(track);
                        }}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      >
                        {currentTrack?.id === track.id && isPlaying ? (
                          <Pause className="w-6 h-6 text-white" />
                        ) : (
                          <Play className="w-6 h-6 text-white" />
                        )}
                      </button>
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{track.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {track.artist_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {formatDuration(track.duration)}
                        </Badge>
                        {track.album_name && (
                          <span className="text-xs text-muted-foreground truncate">
                            {track.album_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Play Button */}
                    <Button
                      variant={currentTrack?.id === track.id ? "default" : "ghost"}
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPause(track);
                      }}
                    >
                      {currentTrack?.id === track.id && isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredTracks.length === 0 && !isSearching && (
          <div className="text-center py-8 text-muted-foreground">
            <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Search for flow-optimized tracks</p>
            <p className="text-sm">Set your tempo and energy preferences, then search</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
