import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AuthRole } from "@/auth/AuthContext";

type Props = {
  role: AuthRole;
  children: ReactNode;
};

export function ProtectedRoute({ role, children }: Props) {
  const { role: current, userAccessToken, mentorAccessToken, adminAccessToken } = useAuth();
  const location = useLocation();

  const tokenOk =
    role === "user"
      ? Boolean(userAccessToken)
      : role === "mentor"
        ? Boolean(mentorAccessToken)
        : Boolean(adminAccessToken);

  const ok = current === role && tokenOk;

  if (!ok) {
    const to =
      role === "user" ? "/login?role=user" : role === "mentor" ? "/login?role=mentor" : "/login?role=admin";
    return <Navigate to={to} state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
