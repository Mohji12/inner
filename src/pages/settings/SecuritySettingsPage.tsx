import React, { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { TwoFactorSetup } from '@/components/auth/TwoFactorSetup';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShieldCheck, ShieldAlert, Lock, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SecuritySettingsPage = () => {
  const { role } = useAuth();
  const [showSetup, setShowSetup] = useState(false);

  // In a real app, we'd fetch the user's current 2FA status from the profile/user object.
  // For this demonstration, we'll assume they need to enable it if they click the button.
  
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-bold">Security Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account security and authentication methods.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Two-Factor Authentication (2FA)
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to your account by requiring more than just a password to log in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showSetup ? (
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Authenticator App</h4>
                    <p className="text-sm text-muted-foreground">
                      Use an app like Google Authenticator or Authy to generate secure codes.
                    </p>
                  </div>
                </div>
                <Button onClick={() => setShowSetup(true)} className="gradient-cta text-white">
                  Setup 2FA
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <TwoFactorSetup 
                  role={role as 'user' | 'mentor'} 
                  onComplete={() => setShowSetup(false)} 
                />
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={() => setShowSetup(false)}>
                    Cancel and go back
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Fingerprint className="w-5 h-5" />
              Biometric Authentication (Planned)
            </CardTitle>
            <CardDescription>
               Use Windows Hello or Touch ID for faster and more secure sign-ins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-orange-500/5 border border-orange-500/20 text-orange-600 text-sm font-medium">
              Coming soon in a future update.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecuritySettingsPage;
