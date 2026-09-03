import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { loginUserGoogle, loginMentorGoogle } from "@/api/auth";
import { useAuth } from "@/auth/AuthContext";
import { humanizeApiError } from "@/lib/humanizeApiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface GoogleLoginButtonProps {
  role: "user" | "mentor";
  on2FARequired: (tempToken: string) => void;
  onAuthenticated?: (role: "user" | "mentor") => void;
}

function needsGoogleLinkPassword(message: string): boolean {
  return /already exists|uses a password|provide your password to link google/i.test(message);
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  role,
  on2FARequired,
  onAuthenticated,
}) => {
  const { setUserSession, setMentorSession } = useAuth();
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkPassword, setLinkPassword] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [linking, setLinking] = useState(false);

  const completeLogin = (accessToken: string) => {
    if (role === "user") setUserSession(accessToken);
    else setMentorSession(accessToken);
    onAuthenticated?.(role);
  };

  const loginWithGoogle = async (idToken: string, password?: string) => {
    const body = { id_token: idToken, link_password: password?.trim() || undefined };
    return role === "user" ? loginUserGoogle(body) : loginMentorGoogle(body);
  };

  const handleGoogleResponse = async (idToken: string, linkPasswordValue?: string) => {
    const res = await loginWithGoogle(idToken, linkPasswordValue);
    if (res.two_factor_required) {
      on2FARequired(res.temp_token!);
      return;
    }
    if (!res.access_token) {
      throw new Error("Google Login failed");
    }
    completeLogin(res.access_token);
  };

  const handleSuccess = async (credentialResponse: { credential?: string }) => {
    const idToken = credentialResponse.credential?.trim();
    if (!idToken) {
      toast.error("Google Login failed");
      return;
    }

    try {
      await handleGoogleResponse(idToken);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error ?? "");
      if (needsGoogleLinkPassword(msg)) {
        setPendingToken(idToken);
        setLinkPassword("");
        setLinkOpen(true);
        return;
      }
      console.error("Google Login Error:", error);
      toast.error(humanizeApiError(error, "Google Login failed"));
    }
  };

  const submitLinkPassword = async () => {
    if (!pendingToken || linkPassword.length < 8) {
      toast.error("Enter your account password (min 8 characters) to link Google.");
      return;
    }
    setLinking(true);
    try {
      await handleGoogleResponse(pendingToken, linkPassword);
      setLinkOpen(false);
      setPendingToken("");
      setLinkPassword("");
    } catch (error: unknown) {
      toast.error(humanizeApiError(error, "Could not link Google to your account."));
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="flex justify-center w-full">
        <GoogleLogin
          onSuccess={(response) => void handleSuccess(response)}
          onError={() => toast.error("Google Login failed")}
          theme="outline"
          shape="pill"
          width="320"
        />
      </div>

      {linkOpen ? (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            This email already has a password account. Enter your password once to link Google sign-in.
          </p>
          <div className="space-y-2">
            <Label htmlFor="google-link-password">Account password</Label>
            <Input
              id="google-link-password"
              type="password"
              value={linkPassword}
              onChange={(e) => setLinkPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="gradient-cta text-white"
              disabled={linking}
              onClick={() => void submitLinkPassword()}
            >
              {linking ? "Linking…" : "Link Google & sign in"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={linking}
              onClick={() => {
                setLinkOpen(false);
                setPendingToken("");
                setLinkPassword("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const GoogleSignIn = GoogleLoginButton;
