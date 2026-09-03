import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { TwoFactorSetup } from "@/components/auth/TwoFactorSetup";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldCheck, Lock, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMentorMe } from "@/api/mentors";
import { getUserMe } from "@/api/users";
import { disableMentor2FA, disableUser2FA } from "@/api/auth";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const SecuritySettingsPage = () => {
  const { role } = useAuth();
  const { t } = useLanguage();
  const s = t.app.securitySettings;
  const queryClient = useQueryClient();
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const accountRole = role === "mentor" ? "mentor" : "user";

  const statusQ = useQuery({
    queryKey: ["security", "2fa-status", accountRole],
    queryFn: () => (accountRole === "mentor" ? getMentorMe() : getUserMe()),
    enabled: role === "user" || role === "mentor",
  });

  const isTotpEnabled = Boolean(statusQ.data?.is_totp_enabled);

  const disableMut = useMutation({
    mutationFn: (body: { password: string; code: string }) =>
      accountRole === "mentor" ? disableMentor2FA(body) : disableUser2FA(body),
    onSuccess: () => {
      toast.success(s.disableSuccess);
      setShowDisable(false);
      setDisablePassword("");
      setDisableCode("");
      void queryClient.invalidateQueries({ queryKey: ["security", "2fa-status", accountRole] });
      if (accountRole === "mentor") {
        void queryClient.invalidateQueries({ queryKey: ["mentor", "me"] });
      }
    },
    onError: (e: Error) => toast.error(e.message || s.disableFailed),
  });

  const onSetupComplete = () => {
    setShowSetup(false);
    void queryClient.invalidateQueries({ queryKey: ["security", "2fa-status", accountRole] });
    if (accountRole === "mentor") {
      void queryClient.invalidateQueries({ queryKey: ["mentor", "me"] });
    }
  };

  if (statusQ.isLoading) {
    return <p className="text-muted-foreground">{s.loading}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold">{s.title}</h1>
        <p className="mt-1 text-muted-foreground">{s.subtitle}</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {s.twoFactorTitle}
            </CardTitle>
            <CardDescription>{s.twoFactorDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {isTotpEnabled && !showSetup ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-emerald-500/10 p-3">
                      <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold">{s.enabledTitle}</h4>
                      <p className="text-sm text-muted-foreground">{s.enabledHint}</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setShowDisable((v) => !v)}>
                    {s.disable2fa}
                  </Button>
                </div>
                {showDisable ? (
                  <div className="space-y-3 rounded-lg border border-border/60 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="disable-pw">{s.disablePassword}</Label>
                      <Input
                        id="disable-pw"
                        type="password"
                        autoComplete="current-password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="disable-code">{s.disableCode}</Label>
                      <Input
                        id="disable-code"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="000000"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                        className="font-mono tracking-widest"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      disabled={disableMut.isPending || !disablePassword || disableCode.length !== 6}
                      onClick={() =>
                        disableMut.mutate({ password: disablePassword, code: disableCode })
                      }
                    >
                      {disableMut.isPending ? s.disabling : s.disableConfirm}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : !showSetup ? (
              <div className="flex flex-col items-start justify-between gap-4 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-primary/10 p-3">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold">{s.authenticatorApp}</h4>
                    <p className="text-sm text-muted-foreground">{s.authenticatorHint}</p>
                  </div>
                </div>
                <Button onClick={() => setShowSetup(true)} className="gradient-cta text-white">
                  {s.setup2fa}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <TwoFactorSetup role={accountRole} onComplete={onSetupComplete} />
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={() => setShowSetup(false)}>
                    {s.cancelSetup}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Fingerprint className="h-5 w-5" />
              {s.biometricTitle}
            </CardTitle>
            <CardDescription>{s.biometricHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 text-sm font-medium text-orange-600">
              {s.biometricSoon}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecuritySettingsPage;
