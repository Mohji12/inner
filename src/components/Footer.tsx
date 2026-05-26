import { Mail, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";

const Footer = () => {
  const { t } = useLanguage();

  const navLinks = [
    { label: t.nav.home, href: "#hero" },
    { label: t.nav.about, href: "#about" },
    { label: t.nav.services, href: "#services" },
    { label: t.nav.pricing, href: "#pricing" },
  ];

  return (
    <footer id="footer" className="bg-primary text-primary-foreground py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <img 
              src="/lifepath%20logo.png" 
              alt="Mijn Levenspad Logo" 
              className="mb-4 h-36 w-auto object-contain md:h-44" 
            />
            <p className="text-primary-foreground/60 text-sm leading-relaxed max-w-xs">
              {t.footer.description}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium uppercase tracking-widest mb-4 text-primary-foreground/80">{t.footer.quickLinks}</h4>
            <ul className="space-y-2.5">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link to="/privacy-policy" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-and-conditions" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium uppercase tracking-widest mb-4 text-primary-foreground/80">{t.footer.contactTitle}</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 text-sm text-primary-foreground/50">
                <Mail className="w-4 h-4 shrink-0" />
                <a
                  href="mailto:pdamahabiersing@outlook.com"
                  className="transition-colors hover:text-primary-foreground"
                >
                  pdamahabiersing@outlook.com
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-primary-foreground/50">
                <MapPin className="w-4 h-4 shrink-0" /> {t.footer.contactCountry}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary-foreground/10 text-center text-xs text-primary-foreground/30">
          © {new Date().getFullYear()} Mijn Levenspad. {t.footer.rights}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
