import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

const AppPageHeader = () => {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: "/", label: t.app.header.backHome, variant: "outline" as const },
    { to: "/user/register", label: t.app.header.userRegister, variant: "ghost" as const },
    { to: "/become-a-coach", label: t.app.header.becomeCoach, variant: "ghost" as const },
    { to: "/mentor/register", label: t.app.header.mentorRegister, variant: "ghost" as const },
    { to: "/login", label: t.app.header.login, variant: "ghost" as const },
    { to: "/login?role=admin", label: t.app.header.adminLogin, variant: "outline" as const },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between gap-3 py-3">
        <Link to="/" className="min-w-0 truncate font-serif text-lg font-semibold text-heading sm:text-xl">
          Mijn Levenspad
        </Link>
        <div className="hidden min-w-0 flex-wrap items-center justify-end gap-2 lg:flex">
          <LanguageSwitcher compact />
          {links.map((item) => (
            <Button key={item.to} asChild variant={item.variant} size="sm">
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <LanguageSwitcher compact />
          <Button asChild variant="outline" size="sm">
            <Link to="/login">{t.app.header.login}</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-expanded={menuOpen}
            aria-label="Open menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {menuOpen ? (
        <div className="container mx-auto flex flex-col gap-2 pb-4 lg:hidden">
          {links.map((item) => (
            <Button key={item.to} asChild variant={item.variant} className="w-full justify-start">
              <Link to={item.to} onClick={() => setMenuOpen(false)}>
                {item.label}
              </Link>
            </Button>
          ))}
        </div>
      ) : null}
    </header>
  );
};

export default AppPageHeader;
