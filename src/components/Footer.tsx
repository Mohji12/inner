import { Mail, MapPin } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/mijn.levenspad/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/mijnlevenspad",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@mijnlevenspad",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
  },
] as const;

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
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/20 text-primary-foreground/60 transition-colors hover:border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  {social.icon}
                </a>
              ))}
            </div>
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
                <Link to="/become-a-coach" className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors">
                  {t.app.header.becomeCoach}
                </Link>
              </li>
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
            <p className="mt-6 text-sm text-primary-foreground/50">
              KVK nummer: <span className="font-bold">82878692</span>
            </p>
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
                  info@mijnlevenspad.com
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
