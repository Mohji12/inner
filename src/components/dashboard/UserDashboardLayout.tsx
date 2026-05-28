import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, LogOut, Receipt, UserRound, Users, Wallet as WalletIcon, LayoutDashboard } from "lucide-react";
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
  dashboardBrandCardClass,
  dashboardLogoutButtonClass,
  dashboardNavLinkClass,
} from "@/components/dashboard/dashboardNav";

export function UserDashboardLayout() {
  const navigate = useNavigate();
  const { logoutUserSession } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardUser;

  const onLogout = async () => {
    await logoutUserSession();
    navigate("/login?role=user", { replace: true });
  };

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader className="border-b border-sidebar-border/60 px-4 py-4">
          <div className={dashboardBrandCardClass}>
            <p className="font-serif text-4xl font-semibold tracking-tight break-words text-heading">Mijn Levenspad</p>
            <p className="text-xs text-muted-foreground break-words">{d.role}</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{d.menu}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Dashboard">
                    <NavLink to="/user/dashboard" className={dashboardNavLinkClass}>
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.profile}>
                    <NavLink to="/user/profile" className={dashboardNavLinkClass}>
                      <UserRound />
                      <span>{d.profile}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.appointments}>
                    <NavLink to="/user/appointments" className={dashboardNavLinkClass}>
                      <CalendarDays />
                      <span>{d.appointments}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.browseMentors}>
                    <NavLink to="/user/mentors" className={dashboardNavLinkClass}>
                      <Users />
                      <span>{d.browseMentors}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.transactions}>
                    <NavLink to="/user/transactions" className={dashboardNavLinkClass}>
                      <Receipt />
                      <span>{d.transactions}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Wallet">
                    <NavLink to="/user/wallet" className={dashboardNavLinkClass}>
                      <WalletIcon />
                      <span>Wallet</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.messages}>
                    <NavLink to="/user/messages" className={dashboardNavLinkClass}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.303.025-.607.047-.912.066a33.153 33.153 0 01-4.706.188L12 19.5l-2.152-2.258a33.21 33.21 0 01-4.705-.188c-.305-.019-.609-.041-.912-.066-1.133-.094-1.98-1.057-1.98-2.193v-4.286c0-.969.616-1.813 1.5-2.097a44.83 44.83 0 0116.5 0z" />
                      </svg>
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
          <span className="text-sm text-muted-foreground flex-1">{d.account}</span>
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
