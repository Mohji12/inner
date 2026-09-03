import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initMetaPixel, trackPageView } from "@/lib/metaPixel";

/** Loads Meta Pixel once and fires PageView on SPA route changes. */
export default function MetaPixel() {
  const location = useLocation();

  useEffect(() => {
    initMetaPixel();
  }, []);

  useEffect(() => {
    trackPageView();
  }, [location.pathname, location.search]);

  return null;
}
