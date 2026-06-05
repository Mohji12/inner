import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { submitCoachApplication } from "@/api/coachApplications";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CoachApplicationForm = () => {
  const { t } = useLanguage();
  const f = t.app.becomeCoach.applicationForm;
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    headline: "",
    motivation: "",
    years: "0",
    languages: "",
    website: "",
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.headline.trim()) {
      toast.error(f.errRequired);
      return;
    }
    if (form.motivation.trim().length < 20) {
      toast.error(f.errMotivation);
      return;
    }

    setIsLoading(true);
    try {
      const languages = form.languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await submitCoachApplication({
        full_name: form.fullName.trim(),
        email: form.email.trim(),
        phone_number: form.phone.trim(),
        headline: form.headline.trim(),
        motivation: form.motivation.trim(),
        years_of_experience: Math.max(0, Number.parseInt(form.years, 10) || 0),
        languages_spoken: languages.length ? languages : undefined,
        website_or_social: form.website.trim() || null,
      });
      setSubmitted(true);
      toast.success(result.message);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : f.errFailed;
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSubmitted(false);
    setForm({
      fullName: "",
      email: "",
      phone: "",
      headline: "",
      motivation: "",
      years: "0",
      languages: "",
      website: "",
    });
  };

  return (
    <Card className="mx-auto max-w-3xl border-border/60 shadow-lg">
      <CardHeader>
        <span className="text-sm font-medium uppercase tracking-widest text-accent">{f.label}</span>
        <CardTitle className="font-serif text-3xl">{f.heading}</CardTitle>
        <CardDescription>{f.sub}</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-lg font-medium">{f.successTitle}</p>
            <p className="text-muted-foreground">{f.successBody}</p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button variant="outline" onClick={resetForm}>
                {f.submitAnother}
              </Button>
              <Button asChild className="gradient-cta text-white">
                <Link to="/mentor/register">{t.app.becomeCoach.ctaRegister}</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-name">{f.fullName}</Label>
              <Input
                id="app-name"
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-email">{f.email}</Label>
              <Input
                id="app-email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-phone">{f.phone}</Label>
              <Input
                id="app-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-headline">{f.headline}</Label>
              <Input
                id="app-headline"
                value={form.headline}
                onChange={(e) => setForm((p) => ({ ...p, headline: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-motivation">{f.motivation}</Label>
              <Textarea
                id="app-motivation"
                rows={5}
                placeholder={f.motivationPlaceholder}
                value={form.motivation}
                onChange={(e) => setForm((p) => ({ ...p, motivation: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-years">{f.years}</Label>
              <Input
                id="app-years"
                type="number"
                min={0}
                max={80}
                value={form.years}
                onChange={(e) => setForm((p) => ({ ...p, years: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-languages">{f.languages}</Label>
              <Input
                id="app-languages"
                placeholder={f.languagesPlaceholder}
                value={form.languages}
                onChange={(e) => setForm((p) => ({ ...p, languages: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="app-website">{f.website}</Label>
              <Input
                id="app-website"
                type="url"
                placeholder="https://"
                value={form.website}
                onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" className="w-full gradient-cta text-white sm:w-auto" disabled={isLoading}>
                {isLoading ? f.submitting : f.submit}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default CoachApplicationForm;
