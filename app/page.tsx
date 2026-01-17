import Link from 'next/link';
import { UX } from '@/lib/constants/ux-terms';
import { Logo } from '@/components/logo';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4 flex items-center justify-center">
          <Logo size="lg" href={undefined} />
        </h1>
        <p className="text-lg text-[var(--muted)] mb-8">
          {UX.TAGLINE}
        </p>

        <div className="flex gap-4 justify-center">
          <Link href="/login" className="btn btn-primary">
            {UX.SIGN_IN}
          </Link>
          <Link href="/about" className="btn btn-secondary">
            Learn more
          </Link>
        </div>

        <div className="mt-16 grid gap-6 text-left">
          <Feature
            title="Edit documentation"
            description="Make changes to Markdown files directly in your browser with a rich editing experience."
          />
          <Feature
            title={UX.PROPOSE_CHANGES}
            description={`When you're ready, ${UX.SUBMIT_FOR_REVIEW.toLowerCase()} with a single click. No technical setup required.`}
          />
          <Feature
            title={UX.VIEW_PROPOSAL}
            description={`Track the status of your ${UX.PROPOSAL.toLowerCase()}s and know when they're ${UX.PUBLISHED.toLowerCase()}.`}
          />
        </div>
      </div>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-[var(--muted)]">{description}</p>
    </div>
  );
}
