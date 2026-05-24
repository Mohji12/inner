import React, { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "./ui/button";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "sonner";
import { apiFetch } from "@/api/client";

interface FavoriteButtonProps {
  mentorId: string;
  className?: string;
  initialIsFavorite?: boolean;
}

export function FavoriteButton({ mentorId, className, initialIsFavorite = false }: FavoriteButtonProps) {
  const { userAccessToken } = useAuth();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [isLoading, setIsLoading] = useState(false);

  // You might want to fetch initial state if not provided
  useEffect(() => {
    if (initialIsFavorite === undefined && userAccessToken) {
      // Could fetch if it's a favorite, but for now we assume it's passed or false
      setIsFavorite(false);
    }
  }, [initialIsFavorite, userAccessToken]);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userAccessToken) {
      toast.error("Please log in to save favorites.");
      return;
    }

    setIsLoading(true);
    try {
      if (isFavorite) {
        await apiFetch(`/favorites/${mentorId}`, { method: "DELETE" });
        setIsFavorite(false);
        toast.success("Removed from favorites");
      } else {
        await apiFetch(`/favorites/${mentorId}`, { method: "POST" });
        setIsFavorite(true);
        toast.success("Added to favorites");
      }
    } catch (err) {
      toast.error("Failed to update favorite status");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggleFavorite}
      disabled={isLoading}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart className={`h-5 w-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
    </Button>
  );
}
