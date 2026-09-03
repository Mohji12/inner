import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { setupUser2FA, verifyUser2FASetup, setupMentor2FA, verifyMentor2FASetup } from '@/api/auth';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Key, Copy, Check } from 'lucide-react';

interface TwoFactorSetupProps {
  role: 'user' | 'mentor';
  onComplete?: () => void;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ role, onComplete }) => {
  const [setupData, setSetupData] = useState<{ secret: string; provisioning_uri: string; qr_code_base64: string } | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSetup();
  }, [role]);

  const loadSetup = async () => {
    try {
      const data = role === 'user' ? await setupUser2FA() : await setupMentor2FA();
      setSetupData(data);
    } catch (error) {
      toast.error('Failed to load 2FA setup');
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    try {
      if (role === 'user') {
        await verifyUser2FASetup({ code });
      } else {
        await verifyMentor2FASetup({ code });
      }
      toast.success('Two-factor authentication enabled!');
      if (onComplete) onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!setupData) return <div className="p-4 text-center">Loading 2FA setup...</div>;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          Setup Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Enhance your account security by adding an extra layer of protection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-lg shadow-sm border">
            <QRCodeSVG value={setupData.provisioning_uri} size={180} />
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Scan this QR code with your authenticator app (like Google Authenticator or Authy).
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Or enter code manually</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded font-mono text-center tracking-widest">
              {setupData.secret}
            </code>
            <Button variant="outline" size="icon" onClick={copySecret}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Verify Code</label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="text-center tracking-[0.5em] text-lg font-mono"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleVerify} disabled={loading || code.length !== 6}>
          {loading ? 'Verifying...' : 'Enable 2FA'}
        </Button>
      </CardFooter>
    </Card>
  );
};
