import { Outlet, useLocation } from "react-router-dom";

/** Re-mounts a light enter animation when the dashboard sub-route changes. */
export function DashboardContentArea() {
  const { pathname } = useLocation();
  return (
    <div
      key={pathname}
      className="w-full min-w-0 max-w-full animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <Outlet />
    </div>
  );
}
