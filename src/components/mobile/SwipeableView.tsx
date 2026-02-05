import { useRef, useState, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeHaptics } from "@/hooks/useNativeHaptics";
import { cn } from "@/lib/utils";

interface SwipeableViewProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftRoute?: string;
  rightRoute?: string;
  threshold?: number;
  className?: string;
}

export function SwipeableView({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftRoute,
  rightRoute,
  threshold = 100,
  className,
}: SwipeableViewProps) {
  const navigate = useNavigate();
  const { selectionFeedback } = useNativeHaptics();
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only allow horizontal swipe if it's more horizontal than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      // Limit the swipe distance with resistance
      const resistance = 0.4;
      const maxSwipe = 150;
      const limitedDelta = Math.sign(deltaX) * Math.min(Math.abs(deltaX) * resistance, maxSwipe);
      setTranslateX(limitedDelta);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (translateX > threshold && (onSwipeRight || rightRoute)) {
      selectionFeedback();
      if (onSwipeRight) onSwipeRight();
      if (rightRoute) navigate(rightRoute);
    } else if (translateX < -threshold && (onSwipeLeft || leftRoute)) {
      selectionFeedback();
      if (onSwipeLeft) onSwipeLeft();
      if (leftRoute) navigate(leftRoute);
    }

    touchStartX.current = null;
    touchStartY.current = null;
    setTranslateX(0);
    setIsDragging(false);
  }, [translateX, threshold, onSwipeLeft, onSwipeRight, leftRoute, rightRoute, navigate, selectionFeedback]);

  return (
    <div
      className={cn("touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${translateX}px)`,
        transition: isDragging ? "none" : "transform 0.3s ease-out",
      }}
    >
      {children}
    </div>
  );
}
