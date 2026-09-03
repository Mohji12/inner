import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** Amplify/S3 301s `/path` → `/path/` which 404s without an SPA rewrite; keep canonical paths slash-free. */
export default function TrailingSlashRedirect() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (pathname.length > 1 && pathname.endsWith("/")) {
      navigate(
        { pathname: pathname.replace(/\/+$/, ""), search, hash },
        { replace: true },
      );
    }
  }, [pathname, search, hash, navigate]);

  return null;
}
