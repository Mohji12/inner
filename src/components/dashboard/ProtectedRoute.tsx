import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, type AuthRole } from "@/auth/AuthContext";

type Props = {
  role: AuthRole;
  children: ReactNode;
};

export function ProtectedRoute({ role, children }: Props) {
  const { role: current, userAccessToken, mentorAccessToken, adminAccessToken, setActiveRole } = useAuth();
  const location = useLocation();

  const tokenOk =
    role === "user"
      ? Boolean(userAccessToken)
      : role === "mentor"
        ? Boolean(mentorAccessToken)
        : Boolean(adminAccessToken);

  useEffect(() => {
    if (tokenOk && current !== role) {
      setActiveRole(role);
    }
  }, [tokenOk, current, role, setActiveRole]);

  if (!tokenOk) {
    const to =
      role === "user" ? "/login?role=user" : role === "mentor" ? "/login?role=mentor" : "/login?role=admin";
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={to} state={{ from: returnTo }} replace />;
  }

  return <>{children}</>;
}
