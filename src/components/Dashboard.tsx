import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Play, Clock, Disc3, LogOut, ExternalLink, CheckCircle2 } from "lucide-react";

interface DashboardProps {
  onLogout: () => void;
  onConnectSpotify: () => void;
  isSpotifyConnected: boolean;
}

const mockSongs = [
  { id: 1, title: "Blinding Lights", artist: "The Weeknd", duration: "3:20" },
  { id: 2, title: "Starboy", artist: "The Weeknd", duration: "3:50" },
  { id: 3, title: "Shape of You", artist: "Ed Sheeran", duration: "3:54" },
  { id: 4, title: "Dance Monkey", artist: "Tones and I", duration: "3:29" },
  { id: 5, title: "Someone Like You", artist: "Adele", duration: "4:45" },
];

const mockSessions = [
  { id: 1, date: "Today", duration: "2h 15m", songs: 32 },
  { id: 2, date: "Yesterday", duration: "1h 45m", songs: 24 },
  { id: 3, date: "Dec 30", duration: "3h 20m", songs: 48 },
];

const Dashboard = ({ onLogout, onConnectSpotify, isSpotifyConnected }: DashboardProps) => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <Music className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Routine</span>
          </div>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back! 👋</h1>
          <p className="text-muted-foreground">Here's your music activity overview.</p>
        </div>

        {/* Spotify Connection Card */}
        <Card className="mb-8 border-2 border-dashed border-accent/30 bg-accent/5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
                  <Disc3 className={`w-7 h-7 text-accent ${isSpotifyConnected ? '' : 'animate-spin'}`} style={{ animationDuration: '3s' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {isSpotifyConnected ? "Spotify Connected" : "Connect Spotify"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {isSpotifyConnected 
                      ? "Your Spotify account is linked and syncing" 
                      : "Link your Spotify to start tracking your music"}
                  </p>
                </div>
              </div>
              <Button 
                variant={isSpotifyConnected ? "outline" : "spotify"} 
                onClick={onConnectSpotify}
                className="gap-2"
              >
                {isSpotifyConnected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Connected
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Connect Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Songs", value: "1,234", icon: Music, color: "text-primary" },
            { label: "Sessions", value: "89", icon: Play, color: "text-accent" },
            { label: "Hours Listened", value: "156h", icon: Clock, color: "text-primary" },
            { label: "Unique Artists", value: "234", icon: Disc3, color: "text-accent" },
          ].map((stat, i) => (
            <Card key={i} className="hover:shadow-card transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Songs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="w-5 h-5 text-primary" />
                Recent Songs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockSongs.map((song) => (
                  <div 
                    key={song.id} 
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{song.title}</div>
                      <div className="text-sm text-muted-foreground truncate">{song.artist}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">{song.duration}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-accent" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockSessions.map((session) => (
                  <div 
                    key={session.id} 
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{session.date}</div>
                      <div className="text-sm text-muted-foreground">{session.songs} songs played</div>
                    </div>
                    <div className="text-sm font-medium text-accent">{session.duration}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
