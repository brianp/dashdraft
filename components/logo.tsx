import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  href?: string;
}

const sizes = {
  sm: 24,
  md: 32,
  lg: 48,
};

export function Logo({ size = 'md', showText = true, href = '/' }: LogoProps) {
  const dimension = sizes[size];

  const content = (
    <span className="flex items-center gap-2">
      <Image
        src="/logo.png"
        alt="DashDraft"
        width={dimension}
        height={dimension}
        className="object-contain"
      />
      {showText && (
        <span className={`font-bold ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-base'}`}>
          DashDraft
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
