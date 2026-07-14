import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Coins, LayoutDashboard, LogOut, MessageSquare, UserRound, FileText, Landmark } from "lucide-react";
import { getMentorActiveChatSession } from "@/api/chat";
import { useAuth } from "@/auth/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/NotificationBell";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { DashboardContentArea } from "@/components/dashboard/DashboardContentArea";
import {
  dashboardLogoutButtonClass,
  dashboardNavLinkClass,
} from "@/components/dashboard/dashboardNav";
import { DashboardBrandHeader } from "@/components/dashboard/DashboardBrandHeader";

export function MentorDashboardLayout() {
  const navigate = useNavigate();
  const { logoutMentorSession } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardMentor;

  const { data: activeChat } = useQuery({
    queryKey: ["chat", "mentor-active"],
    queryFn: getMentorActiveChatSession,
    refetchInterval: 15_000,
  });

  const onLogout = async () => {
    await logoutMentorSession();
    navigate("/login?role=mentor", { replace: true });
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-4">
          <DashboardBrandHeader roleLabel={d.role} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{d.menu}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.dashboard}>
                    <NavLink to="/mentor/dashboard" className={dashboardNavLinkClass}>
                      <LayoutDashboard />
                      <span>{d.dashboard}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.profile}>
                    <NavLink to="/mentor/profile" className={dashboardNavLinkClass}>
                      <UserRound />
                      <span>{d.profile}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.appointments}>
                    <NavLink to="/mentor/appointments" className={dashboardNavLinkClass}>
                      <CalendarDays />
                      <span>{d.appointments}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {activeChat?.id ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={d.activeChat}>
                      <NavLink to={`/mentor/chat/${activeChat.id}`} className={dashboardNavLinkClass}>
                        <MessageSquare />
                        <span>{d.activeChat}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.earnings}>
                    <NavLink to="/mentor/earnings" className={dashboardNavLinkClass}>
                      <Coins />
                      <span>{d.earnings}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.payouts}>
                    <NavLink to="/mentor/payouts" className={dashboardNavLinkClass}>
                      <Landmark />
                      <span>{d.payouts}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.monthlyFees}>
                    <NavLink to="/mentor/invoices" className={dashboardNavLinkClass}>
                      <FileText />
                      <span>{d.monthlyFees}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.messages}>
                    <NavLink to="/mentor/messages" className={dashboardNavLinkClass}>
                      <MessageSquare />
                      <span>{d.messages}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/60 p-2">
          <Button variant="ghost" className={dashboardLogoutButtonClass} onClick={() => void onLogout()}>
            <LogOut className="h-4 w-4" />
            {d.logOut}
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--primary)/0.18),transparent_60%),radial-gradient(circle_at_80%_10%,hsl(var(--accent)/0.14),transparent_55%)]" />
        <header className="relative z-10 flex h-16 items-center gap-2 border-b border-border/60 bg-background/80 backdrop-blur transition-colors duration-200 px-6">
          <SidebarTrigger className="transition-transform duration-200 hover:scale-105 active:scale-95" />
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground flex-1">{d.hub}</span>
          <OnlineStatusBadge />
          <NotificationBell />
        </header>
        <div className="relative z-10 flex-1 overflow-auto p-6">
          <DashboardContentArea />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
