import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, Coins, LayoutDashboard, LogOut, MessageSquare, UserRound, FileText, Landmark, Home, Shield, LifeBuoy, Timer } from "lucide-react";
import { getMentorActiveChatSession } from "@/api/chat";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useDashboardPerson } from "@/hooks/useDashboardPerson";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/NotificationBell";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DashboardContentArea } from "@/components/dashboard/DashboardContentArea";
import { DashboardNavLink } from "@/components/dashboard/DashboardNavLink";
import { dashboardLogoutButtonClass, dashboardChromeHeaderClass, dashboardChromeBodyClass } from "@/components/dashboard/dashboardNav";
import { DashboardBrandHeader } from "@/components/dashboard/DashboardBrandHeader";

function MentorDashboardSidebar() {
  const navigate = useNavigate();
  const { logoutMentorSession } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;
  const personName = useDashboardPerson(d.role);
  const { isMobile, setOpenMobile } = useSidebar();

  const { data: activeChat } = useQuery({
    queryKey: ["chat", "mentor-active"],
    queryFn: getMentorActiveChatSession,
    refetchInterval: 15_000,
  });

  const onLogout = async () => {
    if (isMobile) setOpenMobile(false);
    await logoutMentorSession();
    navigate("/login?role=mentor", { replace: true });
  };

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-4">
          <DashboardBrandHeader roleLabel={personName} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{d.menu}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.dashboard}>
                    <DashboardNavLink to="/mentor/dashboard">
                      <LayoutDashboard />
                      <span>{d.dashboard}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.profile}>
                    <DashboardNavLink to="/mentor/profile">
                      <UserRound />
                      <span>{d.profile}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.availability}>
                    <DashboardNavLink to="/mentor/availability">
                      <Clock />
                      <span>{d.availability}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.platformTime}>
                    <DashboardNavLink to="/mentor/platform-time">
                      <Timer />
                      <span>{d.platformTime}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.security}>
                    <DashboardNavLink to="/mentor/security">
                      <Shield />
                      <span>{d.security}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.support}>
                    <DashboardNavLink to="/mentor/support">
                      <LifeBuoy />
                      <span>{d.support}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.appointments}>
                    <DashboardNavLink to="/mentor/appointments">
                      <CalendarDays />
                      <span>{d.appointments}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {activeChat?.id ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={d.activeChat}>
                      <DashboardNavLink to={`/mentor/chat/${activeChat.id}`}>
                        <MessageSquare />
                        <span>{d.activeChat}</span>
                      </DashboardNavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.earnings}>
                    <DashboardNavLink to="/mentor/earnings">
                      <Coins />
                      <span>{d.earnings}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.payouts}>
                    <DashboardNavLink to="/mentor/payouts">
                      <Landmark />
                      <span>{d.payouts}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.settlements}>
                    <DashboardNavLink to="/mentor/settlements">
                      <FileText />
                      <span>{d.settlements}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.monthlyFees}>
                    <DashboardNavLink to="/mentor/invoices">
                      <FileText />
                      <span>{d.monthlyFees}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.messages}>
                    <DashboardNavLink to="/mentor/messages">
                      <MessageSquare />
                      <span>{d.messages}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/60 p-2 space-y-1">
          <Button variant="ghost" className={dashboardLogoutButtonClass} asChild>
            <Link to="/" title={d.viewWebsiteHint} onClick={closeMobile}>
              <Home className="h-4 w-4" />
              {d.viewWebsite}
            </Link>
          </Button>
          <Button variant="ghost" className={dashboardLogoutButtonClass} onClick={() => void onLogout()}>
            <LogOut className="h-4 w-4" />
            {d.logOut}
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(circle_at_80%_10%,hsl(var(--accent)/0.14),transparent_55%)]" />
        <header className={dashboardChromeHeaderClass}>
          <SidebarTrigger className="shrink-0 transition-transform duration-200 hover:scale-105 active:scale-95" />
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground sm:inline">{d.hub}</span>
          <div className="ml-auto flex min-w-0 shrink items-center gap-1 sm:gap-2">
            <Button variant="outline" size="sm" className="hidden sm:inline-flex gap-1.5" asChild>
              <Link to="/" title={d.viewWebsiteHint}>
                <Home className="h-3.5 w-3.5" />
                {d.viewWebsite}
              </Link>
            </Button>
            <LanguageSwitcher compact />
            <OnlineStatusBadge />
            <NotificationBell />
          </div>
        </header>
        <div className={dashboardChromeBodyClass}>
          <DashboardContentArea />
        </div>
      </SidebarInset>
    </>
  );
}

export function MentorDashboardLayout() {
  return (
    <SidebarProvider>
      <MentorDashboardSidebar />
    </SidebarProvider>
  );
}
