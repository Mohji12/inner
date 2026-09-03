import { Instagram, Mail, MapPin } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SupportQueryForm } from "@/components/SupportQueryForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { submitPublicSupport } from "@/api/contact";
import { useLanguage } from "@/i18n/LanguageContext";

const CONTACT_EMAIL = "info@mijnlevenspad.com";
const KVK = "82878692";

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/mijn.levenspad/" },
  { label: "Facebook", href: "https://www.facebook.com/mijnlevenspad" },
  { label: "TikTok", href: "https://www.tiktok.com/@mijnlevenspad" },
] as const;

const ContactPage = () => {
  const { t } = useLanguage();
  const c = t.app.contactPage;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container mx-auto px-6 py-12 md:py-16">
        <div className="mb-10 max-w-2xl">
          <p className="text-sm uppercase tracking-widest text-accent">{c.label}</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">{c.heading}</h1>
          <p className="mt-3 text-muted-foreground">{c.description}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-xl">{c.detailsTitle}</CardTitle>
              <CardDescription>{c.detailsHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{c.emailLabel}</p>
                  <a className="text-muted-foreground hover:text-foreground" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium">{c.locationLabel}</p>
                  <p className="text-muted-foreground">{t.footer.contactCountry}</p>
                </div>
              </div>
              <div>
                <p className="font-medium">KVK</p>
                <p className="text-muted-foreground">{KVK}</p>
              </div>
              <div>
                <p className="mb-2 font-medium">{c.socialLabel}</p>
                <ul className="space-y-1.5">
                  {SOCIAL_LINKS.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Instagram className="h-3.5 w-3.5" aria-hidden />
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xl">{c.formTitle}</CardTitle>
              <CardDescription>{c.formHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <SupportQueryForm
                mode="public"
                copy={{
                  fullName: c.fullName,
                  email: c.email,
                  phone: c.phone,
                  phoneOptional: c.phoneOptional,
                  role: c.role,
                  roleUser: c.roleUser,
                  roleCoach: c.roleCoach,
                  roleOther: c.roleOther,
                  subject: c.subject,
                  message: c.message,
                  submit: c.submit,
                  submitting: c.submitting,
                  success: c.success,
                }}
                onSubmit={submitPublicSupport}
              />
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
