import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = ({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
      <Icon className="w-8 h-8 text-muted-foreground/60" />
    </div>
    <h3 className="text-lg font-medium mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
    {actionLabel && onAction && (
      <Button onClick={onAction} variant="outline">{actionLabel}</Button>
    )}
  </div>
);
