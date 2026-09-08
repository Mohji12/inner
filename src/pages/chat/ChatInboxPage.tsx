import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { listChatSessions } from "@/api/chat";
import ChatInboxList from "@/components/chat/ChatInboxList";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";

const ChatInboxPage = () => {
  const { role } = useAuth();
  const { t } = useLanguage();
  const c = t.app.chatInbox;

  const { data, isLoading, error } = useQuery({
    queryKey: ["chat", "inbox"],
    queryFn: listChatSessions,
    refetchInterval: 10000,
  });

  if (error) {
    return (
      <Card className="border-destructive/40 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-destructive font-serif">{c.errorTitle}</CardTitle>
          <CardDescription>{c.errorDescription}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const count = data?.sessions?.length ?? 0;
  const countLabel =
    count === 1
      ? c.conversationCount.replace("{count}", String(count))
      : c.conversationCountPlural.replace("{count}", String(count));

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent mb-1 font-medium">{c.eyebrow}</p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl">{c.title}</h1>
        </div>
        {data?.sessions && (
          <p className="text-sm text-muted-foreground">{countLabel}</p>
        )}
      </div>

      <Card className="border-border/60 shadow-lg shadow-black/5 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/60 px-4 py-4 sm:px-6">
          <CardTitle className="text-lg font-serif">{c.recentChats}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 border rounded-xl animate-pulse">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
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
  );
};

export default ChatInboxPage;
