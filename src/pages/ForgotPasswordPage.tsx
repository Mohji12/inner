import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { forgotPassword } from "@/api/auth";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "mentor">("user");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      await forgotPassword({ email, role });
      toast.success("If an account exists, a reset code was sent to your email.");
      navigate("/reset-password", { state: { email, role } });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppPageHeader />
      <main className="container mx-auto px-6 py-10">
        <Card className="mx-auto max-w-xl border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">Forgot Password?</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a 6-digit code to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>I am a...</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={role === "user" ? "default" : "outline"}
                    onClick={() => setRole("user")}
                    className="w-full"
                  >
                    User
                  </Button>
                  <Button
                    type="button"
                    variant={role === "mentor" ? "default" : "outline"}
                    onClick={() => setRole("mentor")}
                    className="w-full"
                  >
                    Coach
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full gradient-cta text-white" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Code"}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-accent hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
