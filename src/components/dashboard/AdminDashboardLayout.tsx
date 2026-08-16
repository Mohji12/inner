import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  Megaphone,
  Clock,
  CreditCard,
  FileText,
  FileUser,
  Landmark,
  LayoutDashboard,
  LogOut,
  Star,
  UserRound,
  Users,
  ShieldCheck,
  Receipt,
} from "lucide-react";
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
import { DashboardContentArea } from "@/components/dashboard/DashboardContentArea";
import { DashboardNavLink } from "@/components/dashboard/DashboardNavLink";
import { dashboardLogoutButtonClass, dashboardChromeHeaderClass, dashboardChromeBodyClass } from "@/components/dashboard/dashboardNav";
import { DashboardBrandHeader } from "@/components/dashboard/DashboardBrandHeader";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

function AdminDashboardSidebar() {
  const navigate = useNavigate();
  const { logoutAdminSession } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;
  const { isMobile, setOpenMobile } = useSidebar();

  const onLogout = async () => {
    if (isMobile) setOpenMobile(false);
    await logoutAdminSession();
    navigate("/login?role=admin", { replace: true });
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
                  <SidebarMenuButton asChild tooltip={d.overview}>
                    <DashboardNavLink to="/admin" end>
                      <LayoutDashboard />
                      <span>{d.overview}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.bookings}>
                    <DashboardNavLink to="/admin/bookings">
                      <CalendarDays />
                      <span>{d.bookings}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.users}>
                    <DashboardNavLink to="/admin/users">
                      <UserRound />
                      <span>{d.users}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.mentors}>
                    <DashboardNavLink to="/admin/mentors">
                      <Users />
                      <span>{d.mentors}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.mentorPresence}>
                    <DashboardNavLink to="/admin/mentor-presence">
                      <Clock />
                      <span>{d.mentorPresence}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.announcements}>
                    <DashboardNavLink to="/admin/announcements">
                      <Megaphone />
                      <span>{d.announcements}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.coachApplications}>
                    <DashboardNavLink to="/admin/coach-applications">
                      <FileUser />
                      <span>{d.coachApplications}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.payments}>
                    <DashboardNavLink to="/admin/payments">
                      <CreditCard />
                      <span>{d.payments}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.allInvoices}>
                    <DashboardNavLink to="/admin/invoices">
                      <FileText />
                      <span>{d.allInvoices}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.allTransactions}>
                    <DashboardNavLink to="/admin/transactions">
                      <Receipt />
                      <span>{d.allTransactions}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.chatInvoices}>
                    <DashboardNavLink to="/admin/chat-invoices">
                      <FileText />
                      <span>{d.chatInvoices}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.mentorInvoices}>
                    <DashboardNavLink to="/admin/mentor-invoices">
                      <FileText />
                      <span>{d.mentorInvoices}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.settlements}>
                    <DashboardNavLink to="/admin/settlements">
                      <Landmark />
                      <span>{d.settlements}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.walletOps}>
                    <DashboardNavLink to="/admin/wallet-ops">
                      <CreditCard />
                      <span>{d.walletOps}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.marketplace}>
                    <DashboardNavLink to="/admin/marketplace">
                      <ShieldCheck />
                      <span>{d.marketplace}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.reviews}>
                    <DashboardNavLink to="/admin/reviews">
                      <Star />
                      <span>{d.reviews}</span>
                    </DashboardNavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.analytics}>
                    <DashboardNavLink to="/admin/analytics">
                      <BarChart3 />
                      <span>{d.analytics}</span>
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
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{d.hub}</span>
          <div className="ml-auto flex min-w-0 shrink items-center">
            <LanguageSwitcher compact />
          </div>
        </header>
        <div className={dashboardChromeBodyClass}>
          <DashboardContentArea />
        </div>
      </SidebarInset>
    </>
  );
}

export function AdminDashboardLayout() {
  return (
    <SidebarProvider>
      <AdminDashboardSidebar />
    </SidebarProvider>
  );
}
