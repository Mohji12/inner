import { FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/api/client";
import { getMentorMe, patchMentorMe } from "@/api/mentors";
import type { MentorAccount } from "@/api/types";
import { commaSeparatedToStringList, stringListToCommaSeparated, unknownListToStrings } from "@/lib/dbJsonFields";
import { normalizeSpokenLanguagesFromApi } from "@/lib/spokenLanguageOptions";
import CoachCardVisibilityPicker from "@/components/CoachCardVisibilityPicker";
import { DEFAULT_COACH_CARD_VISIBILITY, normalizeCoachCardVisibility, type CoachCardVisibility } from "@/lib/coachCardVisibility";
import { resolveBrowserTimeZone } from "@/lib/timeZone";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

async function postMentorImage(kind: "avatar" | "banner", file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const path = kind === "banner" ? "/upload/banner" : "/upload/avatar";
  const data = await apiFetch<{ url: string }>(path, { method: "POST", body: formData });
  return data.url;
}

function validateImageFile(file: File): string | null {
  if (!file.type || !file.type.startsWith("image/")) {
    return "File must be an image";
  }
  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    return "Image must be at most 2 MB";
  }
  return null;
}

const MentorProfilePage = () => {
  const { t } = useLanguage();
  const mr = t.app.mentorRegister;
  const mpf = t.app.mentorProfile;
  const up = t.app.userProfile;
  const [me, setMe] = useState<MentorAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [timezone, setTimezone] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("0");
  const [spokenLanguages, setSpokenLanguages] = useState<string[]>([]);
  const [expertiseCsv, setExpertiseCsv] = useState("");
  const [skillsCsv, setSkillsCsv] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [kvkNumber, setKvkNumber] = useState("");
  const [educationCsv, setEducationCsv] = useState("");
  const [certificationsCsv, setCertificationsCsv] = useState("");
  const [toolsCsv, setToolsCsv] = useState("");
  const [sessionModesCsv, setSessionModesCsv] = useState("");
  const [chatPrice, setChatPrice] = useState("0");
  const [chatCurrency, setChatCurrency] = useState("EUR");
  const [chatMinMinutes, setChatMinMinutes] = useState("1");
  const [cardVisibility, setCardVisibility] = useState<CoachCardVisibility>(DEFAULT_COACH_CARD_VISIBILITY);

  useEffect(() => {
    getMentorMe()
      .then((m) => {
        setMe(m);
        setFullName(m.full_name);
        setCountryCode(m.country_code ?? "");
        setTimezone(m.timezone?.trim() || resolveBrowserTimeZone());
        setProfileImage(m.profile_image ?? "");
        setBannerImage(m.banner_image ?? "");
        setHeadline(m.headline ?? "");
        setBio(m.bio ?? "");
        setYears(String(m.years_of_experience));
        setSpokenLanguages(normalizeSpokenLanguagesFromApi(unknownListToStrings(m.languages_spoken)));
        setExpertiseCsv(stringListToCommaSeparated(unknownListToStrings(m.expertise_areas)));
        setSkillsCsv(stringListToCommaSeparated(unknownListToStrings(m.skills)));
        setCompanyName(m.current_company ?? "");
        setKvkNumber(m.kvk_number ?? "");
        setEducationCsv(stringListToCommaSeparated(unknownListToStrings(m.education)));
        setCertificationsCsv(stringListToCommaSeparated(unknownListToStrings(m.certifications)));
        setToolsCsv(stringListToCommaSeparated(unknownListToStrings(m.tools_technologies)));
        setSessionModesCsv(stringListToCommaSeparated(unknownListToStrings(m.session_modes)));
        setChatPrice(String(m.chat_price_per_minute ?? "0"));
        setChatCurrency(m.chat_currency ?? "EUR");
        setChatMinMinutes(String(m.chat_min_purchase_minutes ?? 1));
        setCardVisibility(normalizeCoachCardVisibility(m.public_card_visibility));
      })
      .catch(() => toast.error(mpf.toastLoadErr))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const list = (s: string) => {
        const v = commaSeparatedToStringList(s);
        return v.length ? v : null;
      };
      const next = await patchMentorMe({
        full_name: fullName,
        country_code: countryCode.trim().toUpperCase() || null,
        timezone: timezone.trim() || null,
        profile_image: profileImage.trim() || null,
        banner_image: bannerImage.trim() || null,
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        years_of_experience: Number(years) || 0,
        languages_spoken: spokenLanguages.length ? spokenLanguages : null,
        expertise_areas: list(expertiseCsv),
        skills: list(skillsCsv),
        current_company: companyName.trim() || null,
        kvk_number: kvkNumber.trim() || null,
        education: list(educationCsv),
        certifications: list(certificationsCsv),
        tools_technologies: list(toolsCsv),
        session_modes: list(sessionModesCsv),
        chat_price_per_minute: chatPrice,
        chat_currency: chatCurrency.trim() || "EUR",
        chat_min_purchase_minutes: Number(chatMinMinutes) || 1,
        public_card_visibility: cardVisibility,
      });
      setMe(next);
      toast.success(mpf.toastOk);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : mpf.toastUpdateErr);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">{mpf.loading}</p>;
  }

  return (
    <Card className="mx-auto max-w-2xl border-border/60">
      <CardHeader>
        <CardTitle className="font-serif text-3xl">{mpf.title}</CardTitle>
        <CardDescription>{mpf.description}</CardDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          <Badge variant={me?.is_approved ? "default" : "secondary"}>
            {me?.is_approved ? mpf.approved : mpf.pending}
          </Badge>
          <Badge variant={me?.is_verified ? "default" : "outline"}>
            {me?.is_verified ? mpf.verified : mpf.unverified}
          </Badge>
          <Badge variant="outline">
            {mpf.status} {me?.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">{mpf.accountSection}</p>
            <div className="space-y-2">
              <Label>{up.email}</Label>
              <Input value={me?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fn">{up.fullName}</Label>
              <Input id="fn" value={fullName} onChange={(ev) => setFullName(ev.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{up.phone}</Label>
              <Input id="phone" value={me?.phone_number ?? ""} disabled />
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
                <Input
                  id="tz"
                  placeholder="e.g. Asia/Kolkata"
                  value={timezone}
                  onChange={(ev) => setTimezone(ev.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pimg">{mr.profileImage}</Label>
              <div className="flex items-center gap-4">
                {profileImage ? (
                  <img
                    src={
                      profileImage.startsWith("/")
                        ? `${String(import.meta.env.VITE_API_URL).replace(/\/api\/v1\/?$/, "")}${profileImage}`
                        : profileImage
                    }
                    alt="Profile"
                    className="h-16 w-16 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                <div className="flex flex-1 flex-col space-y-2">
                  <Input
                    id="pimg"
                    type="url"
                    placeholder="Or enter image URL"
                    value={profileImage}
                    onChange={(ev) => setProfileImage(ev.target.value)}
                  />
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      void (async () => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const validation = validateImageFile(file);
                        if (validation) {
                          toast.error(validation);
                          return;
                        }
                        try {
                          const url = await postMentorImage("avatar", file);
                          setProfileImage(url);
                          toast.success("Profile image uploaded");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to upload image");
                        }
                      })();
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner">Banner / card image</Label>
              <p className="text-xs text-muted-foreground">
                Wide photo shown on the coach directory cards. Separate from profile picture.
              </p>
              {bannerImage ? (
                <div className="overflow-hidden rounded-lg border">
                  <img
                    src={
                      bannerImage.startsWith("/")
                        ? `${String(import.meta.env.VITE_API_URL).replace(/\/api\/v1\/?$/, "")}${bannerImage}`
                        : bannerImage
                    }
                    alt=""
                    className="h-32 w-full object-cover md:h-40"
                  />
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-xs text-muted-foreground md:h-40">
                  No banner yet
                </div>
              )}
              <Input
                id="banner"
                type="url"
                placeholder="Banner image URL"
                value={bannerImage}
                onChange={(ev) => setBannerImage(ev.target.value)}
              />
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  void (async () => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const validation = validateImageFile(file);
                    if (validation) {
                      toast.error(validation);
                      return;
                    }
                    try {
                      const url = await postMentorImage("banner", file);
                      setBannerImage(url);
                      toast.success("Banner uploaded");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to upload banner");
                    }
                  })();
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">{mpf.publicSection}</p>
            <div className="space-y-2">
              <Label htmlFor="headline">{mr.headline}</Label>
              <Input id="headline" value={headline} onChange={(ev) => setHeadline(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">{mr.bio}</Label>
              <Textarea id="bio" rows={5} value={bio} onChange={(ev) => setBio(ev.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lang">{mr.languages}</Label>
                <SpokenLanguageCheckboxGroup
                  id="lang"
                  value={spokenLanguages}
                  onChange={setSpokenLanguages}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="years">{mr.years}</Label>
                <Input id="years" type="number" min={0} value={years} onChange={(ev) => setYears(ev.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp">{mr.expertiseCsv}</Label>
              <Input id="exp" value={expertiseCsv} onChange={(ev) => setExpertiseCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">{mr.skills}</Label>
              <Input id="skills" value={skillsCsv} onChange={(ev) => setSkillsCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{mr.companyName}</Label>
              <Input
                id="company"
                placeholder={mr.phCompanyName}
                value={companyName}
                onChange={(ev) => setCompanyName(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kvk">{mr.kvkNumber}</Label>
              <Input
                id="kvk"
                inputMode="numeric"
                placeholder={mr.phKvkNumber}
                value={kvkNumber}
                onChange={(ev) => setKvkNumber(ev.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edu">{mr.education}</Label>
              <Input id="edu" placeholder={mr.phEducation} value={educationCsv} onChange={(ev) => setEducationCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert">{mr.certifications}</Label>
              <Input id="cert" value={certificationsCsv} onChange={(ev) => setCertificationsCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tools">{mr.tools}</Label>
              <Input id="tools" value={toolsCsv} onChange={(ev) => setToolsCsv(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="modes">{mr.sessionModes}</Label>
              <Input id="modes" placeholder={mr.phModes} value={sessionModesCsv} onChange={(ev) => setSessionModesCsv(ev.target.value)} />
            </div>
            <CoachCardVisibilityPicker
              title={mr.cardVisibilityTitle}
              description={mr.cardVisibilityDescription}
              value={cardVisibility}
              onChange={setCardVisibility}
              labels={mr.cardVisibilityFields}
            />
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent">Text chat (metered)</p>
            <p className="text-sm text-muted-foreground">
              Set price per minute to 0 to disable. Minimum purchase applies when users start or extend a chat.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cprice">Price per minute</Label>
                <Input id="cprice" value={chatPrice} onChange={(ev) => setChatPrice(ev.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ccur">Currency</Label>
                <Input id="ccur" maxLength={8} value={chatCurrency} onChange={(ev) => setChatCurrency(ev.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cmin">Min. purchase (minutes)</Label>
                <Input
                  id="cmin"
                  type="number"
                  min={1}
                  value={chatMinMinutes}
                  onChange={(ev) => setChatMinMinutes(ev.target.value)}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="gradient-cta text-white">
            {mpf.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MentorProfilePage;
