import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";

const AppPageHeader = () => {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link to="/" className="font-serif text-xl font-semibold text-heading">
          Mijn Levenspad
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher compact />
          <Button asChild variant="outline" size="sm">
            <Link to="/">{t.app.header.backHome}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/user/register">{t.app.header.userRegister}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/mentor/register">{t.app.header.mentorRegister}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">{t.app.header.login}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/login?role=admin">{t.app.header.adminLogin}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default AppPageHeader;
