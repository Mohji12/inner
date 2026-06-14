import { useState, useEffect } from "react";
import { Menu, X, Globe, ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { languageLabels, type Language } from "@/i18n/translations";
import LanguageFlag from "@/components/LanguageFlag";
import { cn } from "@/lib/utils";
import { homeSectionTo, scrollToHomeSection } from "@/lib/homeSectionLink";

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
    { label: t.nav.home, to: sectionTo("#hero") },
    { label: t.nav.about, to: sectionTo("#about") },
    { label: t.nav.services, to: sectionTo("#services") },
    { label: t.nav.pricing, to: sectionTo("#pricing") },
    { label: t.nav.contact, to: sectionTo("#footer") },
  ];

  const langs = Object.entries(languageLabels) as [Language, string][];

  return (
    <nav
      className={cn(
        "fixed left-0 right-0 top-0 z-50 border-0 bg-transparent text-zinc-950 shadow-none ring-0 outline-none backdrop-blur-none backdrop-saturate-100 transition-all duration-300",
        scrolled ? "py-3" : "py-4",
      )}
    >
      <div className="container mx-auto flex items-center justify-between px-6">
        <Link
          to={sectionTo("#hero")}
          onClick={() => {
            if (onHome) scrollToHomeSection("#hero");
          }}
          className="flex items-center transition-opacity hover:opacity-80"
        >
          <img src="/lifepath%20logo.png" alt="Mijn Levenspad Logo" className="h-20 w-auto object-contain drop-shadow-sm md:h-24" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={typeof l.to === "string" ? l.to : l.to.hash}
              to={l.to}
              onClick={() => {
                if (onHome) scrollToHomeSection(typeof l.to === "string" ? l.to : l.to.hash ?? "#hero");
              }}
              className="text-lg font-semibold text-zinc-950 transition-colors duration-200 hover:text-black"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/mentors"
            className="text-lg font-semibold text-zinc-950 transition-colors duration-200 hover:text-black"
          >
            {t.app.shell.mentors}
          </Link>
          <Link
            to="/become-a-coach"
            className="text-lg font-semibold text-zinc-950 transition-colors duration-200 hover:text-black"
          >
            {t.app.header.becomeCoach}
          </Link>

          {/* Language selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 text-lg font-semibold text-zinc-950 transition-colors hover:text-black active:scale-95"
            >
              <Globe className="h-5 w-5" />
              <LanguageFlag language={language} />
              {language.toUpperCase()}
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`} />
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] rounded-xl border border-zinc-200/90 bg-white py-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                  {langs.map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => {
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
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-md border border-zinc-400 px-4 py-2 text-base font-semibold text-zinc-950 transition-colors hover:border-zinc-500 hover:bg-zinc-50"
            >
              {t.app.shell.login}
            </Link>
            <Link to="/register" className="gradient-cta rounded-md px-4 py-2 text-base font-semibold text-white transition-opacity hover:opacity-95">
              {t.app.shell.register}
            </Link>
          </div>
        </div>

        <button
          className="text-zinc-950 transition-transform duration-300 hover:text-black md:hidden active:scale-95"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="mx-4 mt-2 flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-xl md:hidden">
          {links.map((l) => (
            <Link
              key={typeof l.to === "string" ? l.to : l.to.hash}
              to={l.to}
              onClick={() => {
                setMenuOpen(false);
                if (onHome) scrollToHomeSection(typeof l.to === "string" ? l.to : l.to.hash ?? "#hero");
              }}
              className="text-lg font-semibold text-zinc-950 transition-colors hover:text-black"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/mentors"
            onClick={() => setMenuOpen(false)}
            className="text-lg font-semibold text-zinc-950 transition-colors hover:text-black"
          >
            {t.app.shell.mentors}
          </Link>
          <Link
            to="/become-a-coach"
            onClick={() => setMenuOpen(false)}
            className="text-lg font-semibold text-zinc-950 transition-colors hover:text-black"
          >
            {t.app.header.becomeCoach}
          </Link>
          <div className="mt-2 border-t border-zinc-200 pt-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="rounded-md border border-zinc-400 px-4 py-2 text-base font-semibold text-zinc-950 hover:bg-zinc-50"
              >
                {t.app.shell.login}
              </Link>
              <Link
                to="/register"
                onClick={() => setMenuOpen(false)}
                className="gradient-cta rounded-md px-4 py-2 text-base font-semibold text-white hover:opacity-95"
              >
                {t.app.shell.register}
              </Link>
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
