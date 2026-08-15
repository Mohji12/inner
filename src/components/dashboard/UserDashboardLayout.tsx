import { useNavigate } from "react-router-dom";
import { CalendarDays, LogOut, Receipt, UserRound, Users, Wallet as WalletIcon, LayoutDashboard, Shield, LifeBuoy } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/NotificationBell";
import { OnlineStatusBadge } from "@/components/OnlineStatusBadge";
import { DashboardContentArea } from "@/components/dashboard/DashboardContentArea";
import { DashboardNavLink } from "@/components/dashboard/DashboardNavLink";
import { dashboardLogoutButtonClass, dashboardChromeHeaderClass, dashboardChromeBodyClass } from "@/components/dashboard/dashboardNav";
import { DashboardBrandHeader } from "@/components/dashboard/DashboardBrandHeader";

function UserDashboardSidebar() {
  const navigate = useNavigate();
  const { logoutUserSession } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardUser;
  const { isMobile, setOpenMobile } = useSidebar();

  const onLogout = async () => {
    if (isMobile) setOpenMobile(false);
    await logoutUserSession();
    navigate("/login?role=user", { replace: true });
  };

  return (
    <>
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
                  <SidebarMenuButton asChild tooltip="Dashboard">
                    <DashboardNavLink to="/user/dashboard">
                      <LayoutDashboard />
                      <span>Dashboard</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.profile}>
                    <DashboardNavLink to="/user/profile">
                      <UserRound />
                      <span>{d.profile}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.security}>
                    <DashboardNavLink to="/user/security">
                      <Shield />
                      <span>{d.security}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.support}>
                    <DashboardNavLink to="/user/support">
                      <LifeBuoy />
                      <span>{d.support}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.appointments}>
                    <DashboardNavLink to="/user/appointments">
                      <CalendarDays />
                      <span>{d.appointments}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.browseMentors}>
                    <DashboardNavLink to="/user/mentors">
                      <Users />
                      <span>{d.browseMentors}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.transactions}>
                    <DashboardNavLink to="/user/transactions">
                      <Receipt />
                      <span>{d.transactions}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Wallet">
                    <DashboardNavLink to="/user/wallet">
                      <WalletIcon />
                      <span>Wallet</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.messages}>
                    <DashboardNavLink to="/user/messages">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.303.025-.607.047-.912.066a33.153 33.153 0 01-4.706.188L12 19.5l-2.152-2.258a33.21 33.21 0 01-4.705-.188c-.305-.019-.609-.041-.912-.066-1.133-.094-1.98-1.057-1.98-2.193v-4.286c0-.969.616-1.813 1.5-2.097a44.83 44.83 0 0116.5 0z" />
                      </svg>
                      <span>{d.messages}</span>
                    </DashboardNavLink>
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
        <header className={dashboardChromeHeaderClass}>
          <SidebarTrigger className="shrink-0 transition-transform duration-200 hover:scale-105 active:scale-95" />
          <Separator orientation="vertical" className="hidden h-6 sm:block" />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{d.account}</span>
          <div className="ml-auto flex min-w-0 shrink items-center gap-1 sm:gap-2">
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

export function UserDashboardLayout() {
  return (
    <SidebarProvider>
      <UserDashboardSidebar />
    </SidebarProvider>
  );
}
