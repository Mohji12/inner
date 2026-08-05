import { useQuery } from "@tanstack/react-query";
import { getMentorMe } from "@/api/mentors";
import { submitMentorSupport } from "@/api/contact";
import { SupportQueryForm } from "@/components/SupportQueryForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";

const MentorSupportPage = () => {
  const { t } = useLanguage();
  const s = t.app.mentorSupport;
  const form = t.app.contactPage;

  const { data: me, isLoading } = useQuery({
    queryKey: ["mentor", "me"],
    queryFn: getMentorMe,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-widest text-muted-foreground">{s.label}</p>
        <h1 className="font-serif text-3xl tracking-tight">{s.heading}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{s.description}</p>
      </div>

      <Card className="border-border/60 max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">{s.formTitle}</CardTitle>
          <CardDescription>{s.formHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !me ? (
            <p className="text-sm text-muted-foreground">{form.loading}</p>
          ) : (
            <SupportQueryForm
              mode="authenticated"
              accountName={me.full_name}
              accountEmail={me.email}
              copy={{
                fullName: form.fullName,
                email: form.email,
                phone: form.phone,
                phoneOptional: form.phoneOptional,
                role: form.role,
                roleUser: form.roleUser,
                roleCoach: form.roleCoach,
                roleOther: form.roleOther,
                subject: form.subject,
                message: form.message,
                submit: form.submit,
                submitting: form.submitting,
                success: form.success,
              }}
              onSubmit={submitMentorSupport}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MentorSupportPage;
