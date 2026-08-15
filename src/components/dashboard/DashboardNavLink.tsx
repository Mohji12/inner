import { forwardRef } from "react";
import { NavLink, type NavLinkProps } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { dashboardNavLinkClass } from "@/components/dashboard/dashboardNav";
import { cn } from "@/lib/utils";

/** Sidebar NavLink that closes the mobile sheet after a tap. */
export const DashboardNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function DashboardNavLink(
  { className, onClick, ...props },
  ref,
) {
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <NavLink
      ref={ref}
      {...props}
      className={(args) => {
        const base = dashboardNavLinkClass(args);
        const extra = typeof className === "function" ? className(args) : className;
        return cn(base, extra);
      }}
      onClick={(event) => {
        if (isMobile) setOpenMobile(false);
        onClick?.(event);
      }}
    />
  );
});
