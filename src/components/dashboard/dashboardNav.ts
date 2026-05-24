import { cn } from "@/lib/utils";

/** NavLink `className` for user / mentor / admin sidebars — hover, active, and icon motion. */
export function dashboardNavLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    "group relative transition-all duration-200 ease-out will-change-transform",
    "hover:bg-sidebar-accent/75 hover:translate-x-0.5",
    "active:scale-[0.98]",
    "[&>svg]:shrink-0 [&>svg]:transition-transform [&>svg]:duration-200",
    "group-hover:[&>svg]:scale-110 group-hover:[&>svg]:text-sidebar-accent-foreground",
    isActive &&
      "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-ring/40",
    !isActive && "text-sidebar-foreground/90",
  );
}

export const dashboardBrandCardClass =
  "glass-card min-w-0 w-full max-w-full break-words rounded-xl p-3 transition-all duration-300 ease-out hover:border-sidebar-accent/40 hover:shadow-md";

export const dashboardLogoutButtonClass =
  "w-full justify-start gap-2 transition-all duration-200 hover:bg-sidebar-accent/60 hover:translate-x-0.5 active:scale-[0.98]";
