import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { listChatSessions } from "@/api/chat";
import ChatInboxList from "@/components/chat/ChatInboxList";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import AppPageHeader from "@/components/AppPageHeader";

const ChatInboxPage = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat", "inbox"],
    queryFn: listChatSessions,
    refetchInterval: 10000, // Poll every 10 seconds for unread updates
  });

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <AppPageHeader />
        <main className="container mx-auto px-6 py-10">
          <Card className="border-destructive/40 max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive font-serif">Error loading inbox</CardTitle>
              <CardDescription>We couldn't fetch your conversations. Please try again later.</CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs uppercase tracking-widest text-accent mb-1 font-medium">Communication</p>
              <h1 className="font-serif text-4xl lg:text-5xl">Your Messages</h1>
            </div>
            {data?.sessions && (
              <p className="text-sm text-muted-foreground mb-1">
                {data.sessions.length} conversation{data.sessions.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <Card className="border-border/60 shadow-lg shadow-black/5 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/60 px-6 py-4">
                <CardTitle className="text-lg font-serif">Recent Chats</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-xl animate-pulse">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ChatInboxList sessions={data?.sessions || []} role={role as "user" | "mentor"} />
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ChatInboxPage;
