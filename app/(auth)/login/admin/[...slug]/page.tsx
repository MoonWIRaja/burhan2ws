'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { NeonTitle } from '@/components/neon/neon-text';
import { NeonBox } from '@/components/neon/neon-box';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/lib/hooks/use-toast';

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const attemptLogin = async () => {
      try {
        // Extract password from URL: /login/admin:password
        const slugArray = params.slug as string[];
        const fullSlug = slugArray.join('/');
        
        // Expected format: admin:password or just password after admin:
        let password = '';
        if (fullSlug.startsWith('admin:')) {
          password = fullSlug.replace('admin:', '');
        } else {
          password = fullSlug;
        }

        if (!password) {
          setError('Invalid admin login URL. Use: /login/admin:password');
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/auth/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await res.json();

        if (data.success) {
          toast({
            title: 'Admin Login Successful',
            description: 'Redirecting to dashboard...',
            variant: 'success',
          });
          setTimeout(() => {
            router.push('/dashboard');
          }, 1000);
        } else {
          setError(data.error || 'Invalid admin password');
          setIsLoading(false);
        }
      } catch (err) {
        setError('Login failed. Please try again.');
        setIsLoading(false);
      }
    };

    attemptLogin();
  }, [params, router, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <NeonBox variant="card" className="max-w-md w-full text-center p-8 space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full neon-border flex items-center justify-center">
          <Shield className="h-10 w-10 neon-text" />
        </div>

        <NeonTitle level={2} animated>
          Admin Access
        </NeonTitle>

        {isLoading ? (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 mx-auto neon-text animate-spin" />
            <p className="text-[var(--text-dim)] font-mono">
              Authenticating...
            </p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-[var(--neon-red)] font-mono">
              {error}
            </p>
            <Button
              variant="neon"
              onClick={() => router.push('/')}
            >
              Back to Home
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Loader2 className="h-8 w-8 mx-auto neon-text animate-spin" />
            <p className="text-[var(--neon-green)] font-mono">
              Login successful! Redirecting...
            </p>
          </div>
        )}

        <p className="text-xs text-[var(--text-dim)] font-mono">
          URL Format: /login/admin:your-password
        </p>
      </NeonBox>
    </div>
  );
}



