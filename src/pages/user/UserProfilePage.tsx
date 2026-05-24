import { FormEvent, useEffect, useState } from "react";
import { getUserMe, patchUserMe } from "@/api/users";
import type { UserOut } from "@/api/types";
import {
  commaSeparatedToStringList,
  stringListToCommaSeparated,
  unknownListToStrings,
} from "@/lib/dbJsonFields";
import { resolveBrowserTimeZone } from "@/lib/timeZone";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

const UserProfilePage = () => {
  const { t } = useLanguage();
  const up = t.app.userProfile;
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [location, setLocation] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [goals, setGoals] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [preferredCommunicationMode, setPreferredCommunicationMode] = useState("");
  const [interestsCsv, setInterestsCsv] = useState("");
  const [categoriesCsv, setCategoriesCsv] = useState("");

  useEffect(() => {
    getUserMe()
      .then((u) => {
        setUser(u);
        setFullName(u.full_name);
        setProfileImage(u.profile_image ?? "");
        setGender(u.gender ?? "");
        setDateOfBirth(dateInputValue(u.date_of_birth));
        setLocation(u.location ?? "");
        setCountryCode(u.country_code ?? "");
        setTimezone(u.timezone?.trim() || resolveBrowserTimeZone());
        setGoals(u.goals ?? "");
        setPreferredLanguage(u.preferred_language);
        setPreferredCommunicationMode(u.preferred_communication_mode ?? "");
        setInterestsCsv(stringListToCommaSeparated(unknownListToStrings(u.interests)));
        setCategoriesCsv(stringListToCommaSeparated(unknownListToStrings(u.preferred_categories)));
      })
      .catch(() => toast.error(up.toastLoadErr))
      .finally(() => setLoading(false));
    // Initial load only; labels update via `t` on re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const interests = commaSeparatedToStringList(interestsCsv);
      const categories = commaSeparatedToStringList(categoriesCsv);
      const next = await patchUserMe({
        full_name: fullName,
        profile_image: profileImage.trim() || null,
        gender: gender.trim() || null,
        date_of_birth: dateOfBirth.trim() || null,
        location: location.trim() || null,
        country_code: countryCode.trim().toUpperCase() || null,
        timezone: timezone.trim() || undefined,
        goals: goals.trim() || null,
        preferred_language: preferredLanguage.trim() || undefined,
        preferred_communication_mode: preferredCommunicationMode.trim() || null,
        interests: interests.length ? interests : null,
        preferred_categories: categories.length ? categories : null,
      });
      setUser(next);
      toast.success(up.toastOk);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : up.toastUpdateErr);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">{up.loading}</p>;
  }

  return (
    <Card className="mx-auto max-w-2xl border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-3xl">{up.title}</CardTitle>
        <CardDescription>{up.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">{up.account}</p>
            <div className="space-y-2">
              <Label htmlFor="email">{up.email}</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{up.phone}</Label>
              <Input id="phone" value={user?.phone_number ?? ""} disabled />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">{up.profile}</p>
            <div className="space-y-2">
              <Label htmlFor="full_name">{up.fullName}</Label>
              <Input id="full_name" value={fullName} onChange={(ev) => setFullName(ev.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar">{up.profileImageUrl}</Label>
              <Input
                id="avatar"
                type="url"
                placeholder="https://…"
                value={profileImage}
                onChange={(ev) => setProfileImage(ev.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gender">{up.gender}</Label>
                <Input id="gender" value={gender} onChange={(ev) => setGender(ev.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">{up.dob}</Label>
                <Input id="dob" type="date" value={dateOfBirth} onChange={(ev) => setDateOfBirth(ev.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{up.location}</Label>
              <Input id="location" value={location} onChange={(ev) => setLocation(ev.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="country">Country (ISO-2)</Label>
                <Input
                  id="country"
                  placeholder="IN"
                  maxLength={2}
                  value={countryCode}
                  onChange={(ev) => setCountryCode(ev.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tz">{up.timezone}</Label>
                <Input id="tz" placeholder="e.g. Europe/Berlin" value={timezone} onChange={(ev) => setTimezone(ev.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">{up.preferences}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lang">{up.preferredLang}</Label>
                <Input id="lang" value={preferredLanguage} onChange={(ev) => setPreferredLanguage(ev.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comm">{up.commMode}</Label>
                <Input
                  id="comm"
                  placeholder="video, voice, chat…"
                  value={preferredCommunicationMode}
                  onChange={(ev) => setPreferredCommunicationMode(ev.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="interests">{up.interestsCsv}</Label>
              <Input id="interests" value={interestsCsv} onChange={(ev) => setInterestsCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cats">{up.categoriesCsv}</Label>
              <Input id="cats" value={categoriesCsv} onChange={(ev) => setCategoriesCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goals">{up.goals}</Label>
              <Textarea id="goals" rows={4} value={goals} onChange={(ev) => setGoals(ev.target.value)} />
            </div>
          </div>

          <Button type="submit" className="gradient-cta text-white">
            {up.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default UserProfilePage;
