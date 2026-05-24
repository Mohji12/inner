export function marketplaceStatusTone(status: string): "default" | "outline" | "secondary" | "destructive" {
  const s = status.toLowerCase();
  if (["paid", "approved", "verified", "active", "enabled"].includes(s)) return "secondary";
  if (["failed", "rejected", "error", "disabled"].includes(s)) return "destructive";
  if (["pending", "requested", "processing", "pending_verification"].includes(s)) return "outline";
  return "default";
}

export function titleizeMarketplaceStatus(status: string): string {
  return status
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}
