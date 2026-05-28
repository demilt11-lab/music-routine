import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="text-muted-foreground">This page drifted out of flow.</p>
      <Button asChild>
        <Link to="/dashboard">Back to BioMusic</Link>
      </Button>
    </div>
  );
}
