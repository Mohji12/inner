import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthOptional } from "@/auth/AuthContext";
import { reportPageView } from "@/lib/siteVisits";

/** Records anonymous public page views for the admin analytics dashboard. */
export default function SiteVisitTracker() {
  const location = useLocation();
  const role = useAuthOptional()?.role ?? null;

  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    reportPageView(path, role ?? "guest");
  }, [location.pathname, location.search, role]);

  return null;
}
