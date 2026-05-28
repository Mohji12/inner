import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DashboardContentArea } from "@/components/dashboard/DashboardContentArea";
import {
  dashboardBrandCardClass,
  dashboardLogoutButtonClass,
  dashboardNavLinkClass,
} from "@/components/dashboard/dashboardNav";

export function AdminDashboardLayout() {
  const navigate = useNavigate();
  const { logoutAdminSession } = useAuth();
  const { t } = useLanguage();
  const d = t.app.dashboardAdmin;

  const onLogout = async () => {
    await logoutAdminSession();
    navigate("/login?role=admin", { replace: true });
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
                  <SidebarMenuButton asChild tooltip={d.overview}>
                    <NavLink to="/admin" end className={dashboardNavLinkClass}>
                      <LayoutDashboard />
                      <span>{d.overview}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.bookings}>
                    <NavLink to="/admin/bookings" className={dashboardNavLinkClass}>
                      <CalendarDays />
                      <span>{d.bookings}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.users}>
                    <NavLink to="/admin/users" className={dashboardNavLinkClass}>
                      <UserRound />
                      <span>{d.users}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.mentors}>
                    <NavLink to="/admin/mentors" className={dashboardNavLinkClass}>
                      <Users />
                      <span>{d.mentors}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.payments}>
                    <NavLink to="/admin/payments" className={dashboardNavLinkClass}>
                      <CreditCard />
                      <span>{d.payments}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="All invoices">
                    <NavLink to="/admin/invoices" className={dashboardNavLinkClass}>
                      <FileText />
                      <span>All invoices</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="All transactions">
                    <NavLink to="/admin/transactions" className={dashboardNavLinkClass}>
                      <Receipt />
                      <span>Transactions</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.chatInvoices}>
                    <NavLink to="/admin/chat-invoices" className={dashboardNavLinkClass}>
                      <FileText />
                      <span>{d.chatInvoices}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.mentorInvoices}>
                    <NavLink to="/admin/mentor-invoices" className={dashboardNavLinkClass}>
                      <FileText />
                      <span>{d.mentorInvoices}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.settlements}>
                    <NavLink to="/admin/settlements" className={dashboardNavLinkClass}>
                      <Landmark />
                      <span>{d.settlements}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.walletOps}>
                    <NavLink to="/admin/wallet-ops" className={dashboardNavLinkClass}>
                      <CreditCard />
                      <span>{d.walletOps}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.marketplace}>
                    <NavLink to="/admin/marketplace" className={dashboardNavLinkClass}>
                      <ShieldCheck />
                      <span>{d.marketplace}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.reviews}>
                    <NavLink to="/admin/reviews" className={dashboardNavLinkClass}>
                      <Star />
                      <span>{d.reviews}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip={d.analytics}>
                    <NavLink to="/admin/analytics" className={dashboardNavLinkClass}>
                      <BarChart3 />
                      <span>{d.analytics}</span>
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
          <span className="text-sm text-muted-foreground">{d.hub}</span>
        </header>
        <div className="relative z-10 flex-1 overflow-auto p-6">
          <DashboardContentArea />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
