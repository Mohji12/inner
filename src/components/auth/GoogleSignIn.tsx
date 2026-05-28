import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { loginUserGoogle, loginMentorGoogle } from '@/api/auth';
import { useAuth } from '@/auth/AuthContext';
import { toast } from 'sonner';

interface GoogleLoginButtonProps {
  role: 'user' | 'mentor';
  on2FARequired: (tempToken: string) => void;
  onAuthenticated?: (role: 'user' | 'mentor') => void;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({ role, on2FARequired, onAuthenticated }) => {
  const { setUserSession, setMentorSession } = useAuth();

  const handleSuccess = async (credentialResponse: any) => {
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential returned');
      }

      const res = role === 'user' 
        ? await loginUserGoogle({ id_token: credentialResponse.credential })
        : await loginMentorGoogle({ id_token: credentialResponse.credential });

      if (res.two_factor_required) {
        on2FARequired(res.temp_token!);
        return;
      }

      if (role === "user") setUserSession(res.access_token);
      else setMentorSession(res.access_token);
      onAuthenticated?.(role);
    } catch (error: any) {
      console.error('Google Login Error:', error);
      toast.error(error.message || 'Google Login failed');
    }
  };

  return (
    <div className="flex justify-center w-full">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => toast.error('Google Login failed')}
        theme="outline"
        shape="pill"
        width="320"
      />
    </div>
  );
};

export const GoogleSignIn = GoogleLoginButton;
