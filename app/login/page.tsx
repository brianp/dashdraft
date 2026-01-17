'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UX } from '@/lib/constants/ux-terms';
import { Suspense } from 'react';
import { Logo } from '@/components/logo';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect');
  const installed = searchParams.get('installed');

  // Build the auth start URL with redirect parameter
  const authUrl = redirect
    ? `/api/auth/start?redirect=${encodeURIComponent(redirect)}`
    : '/api/auth/start';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <p className="text-[var(--muted)] mt-2">
            Sign in to edit documentation
          </p>
        </div>

        {installed && (
          <div className="card mb-6 border-[var(--primary)] bg-[var(--primary)]/10">
            <p className="text-sm">
              App installed successfully! Sign in to access your repositories.
            </p>
          </div>
        )}

        {error && (
          <div className="card mb-6 border-[var(--error)] bg-[var(--error)]/10">
            <p className="text-[var(--error)] text-sm">{error}</p>
          </div>
        )}

        <div className="card">
          <a
            href={authUrl}
            className="btn btn-primary w-full flex items-center justify-center gap-3"
          >
            <GitHubIcon />
            {UX.SIGN_IN}
          </a>

          <p className="text-xs text-[var(--muted)] mt-4 text-center">
            By signing in, you allow this app to access repositories where
            you&apos;ve installed it.
          </p>
        </div>

        <div className="text-center mt-8">
          <Link href="/" className="text-sm text-[var(--muted)] hover:underline">
            &larr; Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginLoading() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <Logo size="lg" href={undefined} />
          </div>
          <p className="text-[var(--muted)] mt-2">Loading...</p>
        </div>
      </div>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
