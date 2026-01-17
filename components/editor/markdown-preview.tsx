'use client';

import { useState, useEffect, useRef } from 'react';
import { markdownToHtml, previewStyles } from '@/lib/markdown/preview-pipeline';
import { UX } from '@/lib/constants/ux-terms';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        setLoading(true);
        setError(null);
        const rendered = await markdownToHtml(content);

        if (!cancelled) {
          setHtml(rendered);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render preview');
          setLoading(false);
        }
      }
    }

    // Debounce rendering for better performance while typing
    const timeoutId = setTimeout(render, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [content]);

  if (loading && !html) {
    return (
      <div className={`p-4 text-[var(--muted)] ${className}`}>
        {UX.LOADING}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-[var(--error)] ${className}`}>
        {error}
      </div>
    );
  }

  return (
    <>
      <style>{previewStyles}</style>
      <div
        ref={containerRef}
        className={`markdown-preview p-6 overflow-auto ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
