import { useState, useEffect } from "react";
import { Menu, X, Globe, ChevronDown, LayoutDashboard, LogIn } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { languageLabels, type Language } from "@/i18n/translations";
import LanguageFlag from "@/components/LanguageFlag";
import { cn } from "@/lib/utils";
import { homeSectionTo, scrollToHomeSection } from "@/lib/homeSectionLink";
import { useAuthOptional, type AuthRole } from "@/auth/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AuthNavActionsProps = {
  /** Compact desktop trigger vs full stacked mobile list */
  variant?: "desktop" | "mobile";
  onNavigate?: () => void;
};

/** Public-site auth CTAs: hubs for each signed-in role + login for another role. */
function AuthNavActions({ variant = "desktop", onNavigate }: AuthNavActionsProps) {
  const auth = useAuthOptional();
  const { t } = useLanguage();

  const hasUser = Boolean(auth?.userAccessToken);
  const hasCoach = Boolean(auth?.mentorAccessToken);
  const hasAdmin = Boolean(auth?.adminAccessToken);
  const anySession = hasUser || hasCoach || hasAdmin;

  const activate = (role: AuthRole) => {
    auth?.setActiveRole(role);
    onNavigate?.();
  };

  if (!anySession) {
    if (variant === "mobile") {
      return (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            to="/login"
            onClick={onNavigate}
            className="inline-flex flex-1 items-center justify-center rounded-md border border-zinc-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-50"
          >
            {t.app.shell.login}
          </Link>
          <Link
            to="/register"
            onClick={onNavigate}
            className="inline-flex flex-1 items-center justify-center gradient-cta rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            {t.app.shell.register}
          </Link>
        </div>
      );
    }
    return (
      <div className="flex shrink-0 items-center gap-2">
        <Link
          to="/login"
          className="rounded-md border border-zinc-400 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:border-zinc-500 hover:bg-zinc-50 xl:px-4"
        >
          {t.app.shell.login}
        </Link>
        <Link
          to="/register"
          className="gradient-cta rounded-md px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 xl:px-4"
        >
          {t.app.shell.register}
        </Link>
      </div>
    );
  }

  const hubs: { role: AuthRole; to: string; label: string }[] = [];
  if (hasCoach) hubs.push({ role: "mentor", to: "/mentor/dashboard", label: t.app.header.mentorHub });
  if (hasUser) hubs.push({ role: "user", to: "/user/dashboard", label: t.app.header.userHub });
  if (hasAdmin) hubs.push({ role: "admin", to: "/admin", label: t.app.header.adminHub });

  const primary = hubs[0];

  if (variant === "mobile") {
    return (
      <div className="flex w-full flex-col gap-2">
        {hubs.map((h) => (
          <Link
            key={h.to}
            to={h.to}
            onClick={() => activate(h.role)}
            className="inline-flex w-full items-center justify-center gap-2 gradient-cta rounded-md px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="truncate">{h.label}</span>
          </Link>
        ))}
        <Link
          to="/login"
          onClick={onNavigate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-zinc-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-zinc-50"
        >
          <LogIn className="h-4 w-4 shrink-0" />
          <span className="truncate">{t.app.header.loginAnotherRole}</span>
        </Link>
      </div>
    );
  }

  // Desktop: one primary hub + compact account menu (avoids overflow on laptop widths).
  return (
    <div className="flex shrink-0 items-center gap-2">
      {primary ? (
        <Link
          to={primary.to}
          onClick={() => activate(primary.role)}
          className="inline-flex max-w-[9.5rem] items-center gap-1.5 gradient-cta rounded-md px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 xl:max-w-none xl:gap-2 xl:px-4"
          title={primary.label}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="truncate">{primary.label}</span>
        </Link>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-zinc-400 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:border-zinc-500 hover:bg-zinc-50"
          >
            {t.app.header.accountMenu}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]">
          {hubs.map((h) => (
            <DropdownMenuItem key={h.to} asChild>
              <Link to={h.to} onClick={() => activate(h.role)} className="cursor-pointer gap-2">
                <LayoutDashboard className="h-4 w-4" />
                {h.label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/login" className="cursor-pointer gap-2">
              <LogIn className="h-4 w-4" />
              {t.app.header.loginAnotherRole}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const Navbar = () => {
  const location = useLocation();
  const onHome = location.pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sectionTo = (hash: string) => homeSectionTo(location.pathname, hash);

  const links = [
    { label: t.nav.home, to: sectionTo("#hero"), section: true },
    { label: t.nav.about, to: sectionTo("#about"), section: true },
    { label: t.nav.services, to: sectionTo("#services"), section: true },
    { label: t.nav.pricing, to: sectionTo("#pricing"), section: true },
    { label: t.nav.contact, to: "/contact", section: false },
  ];

  const langs = Object.entries(languageLabels) as [Language, string][];

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 top-0 z-50 border-0 text-zinc-950 shadow-none ring-0 outline-none transition-all duration-300",
        scrolled || !onHome
          ? "border-b border-border/50 bg-background/95 py-3 backdrop-blur-md"
          : "bg-transparent py-4 backdrop-blur-none backdrop-saturate-100",
      )}
    >
      <div className="container mx-auto flex min-w-0 items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          to={sectionTo("#hero")}
          onClick={() => {
            if (onHome) scrollToHomeSection("#hero");
          }}
          className="flex min-w-0 shrink items-center transition-opacity hover:opacity-80"
        >
          <img
            src="/lifepath%20logo.png"
            alt="Mijn Levenspad Logo"
            className="h-10 w-auto max-w-[8.5rem] object-contain drop-shadow-sm sm:h-11 sm:max-w-[10rem] md:h-12 md:max-w-[11rem] lg:h-14 lg:max-w-[12.5rem] xl:h-16 xl:max-w-[14rem]"
          />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 lg:flex xl:gap-5">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 xl:gap-x-5">
            {links.map((l) => (
              <Link
                key={typeof l.to === "string" ? l.to : l.to.hash}
                to={l.to}
                onClick={() => {
                  if (l.section && onHome) {
                    scrollToHomeSection(typeof l.to === "string" ? l.to : l.to.hash ?? "#hero");
                  }
                  setMenuOpen(false);
                }}
                className="whitespace-nowrap text-sm font-semibold text-zinc-950 transition-colors duration-200 hover:text-black xl:text-base"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/mentors"
              className="whitespace-nowrap text-sm font-semibold text-zinc-950 transition-colors duration-200 hover:text-black xl:text-base"
            >
              {t.app.shell.mentors}
            </Link>
            <Link
              to="/become-a-coach"
              className="whitespace-nowrap text-sm font-semibold text-zinc-950 transition-colors duration-200 hover:text-black xl:text-base"
            >
              {t.app.header.becomeCoach}
            </Link>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950 transition-colors hover:text-black active:scale-95 xl:gap-2 xl:text-base"
            >
              <Globe className="h-4 w-4 xl:h-5 xl:w-5" />
              <LanguageFlag language={language} />
              <span className="hidden sm:inline">{language.toUpperCase()}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 xl:h-4 xl:w-4 ${langOpen ? "rotate-180" : ""}`} />
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-zinc-200/90 bg-white py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  {langs.map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLanguage(code);
                        setLangOpen(false);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLanguage(code);
                        setLangOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-100 ${language === code ? "bg-zinc-100 font-semibold" : "font-normal"
                        }`}
                    >
                      <LanguageFlag language={code} className="h-5 w-[1.875rem]" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <AuthNavActions variant="desktop" />
        </div>

        <button
          className="shrink-0 text-zinc-950 transition-transform duration-300 hover:text-black lg:hidden active:scale-95"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="mx-4 mt-2 flex max-h-[min(80vh,40rem)] flex-col gap-4 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl sm:p-6 lg:hidden">
          {links.map((l) => (
            <Link
              key={typeof l.to === "string" ? l.to : l.to.hash}
              to={l.to}
              onClick={() => {
                setMenuOpen(false);
                if (l.section && onHome) {
                  scrollToHomeSection(typeof l.to === "string" ? l.to : l.to.hash ?? "#hero");
                }
              }}
              className="text-base font-semibold text-zinc-950 transition-colors hover:text-black"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/mentors"
            onClick={() => setMenuOpen(false)}
            className="text-base font-semibold text-zinc-950 transition-colors hover:text-black"
          >
            {t.app.shell.mentors}
          </Link>
          <Link
            to="/become-a-coach"
            onClick={() => setMenuOpen(false)}
            className="text-base font-semibold text-zinc-950 transition-colors hover:text-black"
          >
            {t.app.header.becomeCoach}
          </Link>
          <div className="mt-1 border-t border-zinc-200 pt-4">
            <div className="mb-4">
              <AuthNavActions variant="mobile" onNavigate={() => setMenuOpen(false)} />
            </div>
            <p className="mb-3 text-xs uppercase tracking-widest text-zinc-500">{t.app.shell.language}</p>
            <div className="flex flex-wrap gap-2">
              {langs.map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => {
                    setLanguage(code);
                    setMenuOpen(false);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors active:scale-95 ${language === code
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                    }`}
                >
                  <LanguageFlag language={code} className="h-4 w-6" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
