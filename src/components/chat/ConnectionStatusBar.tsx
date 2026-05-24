import { WifiOff } from "lucide-react";

interface ConnectionStatusBarProps {
  status: "connected" | "reconnecting" | "disconnected";
}

export const ConnectionStatusBar = ({ status }: ConnectionStatusBarProps) => {
  if (status === "connected") return null;

  const isReconnecting = status === "reconnecting";

  return (
    <div 
      className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium transition-all duration-300 animate-in slide-in-from-top-full ${
        isReconnecting 
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" 
          : "bg-destructive/10 text-destructive dark:bg-destructive/20"
      }`}
    >
      {isReconnecting ? (
        <>
          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Connection lost. Reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Disconnected.</span>
        </>
      )}
    </div>
  );
};
