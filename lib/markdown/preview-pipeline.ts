/**
 * Markdown Preview Pipeline
 *
 * Processes Markdown content to HTML for preview.
 * Uses remark/rehype with sanitization for security.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';

// ============================================================================
// Pipeline Configuration
// ============================================================================

/**
 * Custom sanitization schema
 * Extends default schema to allow some additional elements
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow class on code blocks for syntax highlighting
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    // Allow id for heading anchors
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'id'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'id'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'id'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'id'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'id'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'id'],
  },
};

/**
 * Create the Markdown processing pipeline
 */
function createPipeline() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);
}

// Singleton pipeline instance
let pipeline: ReturnType<typeof createPipeline> | null = null;

function getPipeline() {
  if (!pipeline) {
    pipeline = createPipeline();
  }
  return pipeline;
}

// ============================================================================
// Markdown Processing
// ============================================================================

/**
 * Convert Markdown to HTML
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  const processor = getPipeline();
  const result = await processor.process(markdown);
  return String(result);
}

/**
 * Synchronous version for simpler use cases
 * Note: This still returns a promise due to unified's API
 */
export function markdownToHtmlSync(markdown: string): Promise<string> {
  return markdownToHtml(markdown);
}

// ============================================================================
// Image URL Processing
// ============================================================================

/**
 * Transform relative image URLs in HTML to absolute URLs
 * This is needed to correctly display images in the preview
 */
export function transformImageUrls(
  html: string,
  basePath: string,
  assetUrlPrefix: string
): string {
  // Match src attributes in img tags
  const imgSrcRegex = /(<img[^>]*\ssrc=["'])([^"']+)(["'][^>]*>)/gi;

  return html.replace(imgSrcRegex, (match, prefix, src, suffix) => {
    // Skip absolute URLs and data URLs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
      return match;
    }

    // Resolve relative URL
    const absoluteUrl = resolveRelativeUrl(src, basePath, assetUrlPrefix);
    return `${prefix}${absoluteUrl}${suffix}`;
  });
}

/**
 * Resolve a relative URL to an absolute URL
 */
function resolveRelativeUrl(
  relativePath: string,
  basePath: string,
  assetUrlPrefix: string
): string {
  // Remove leading ./
  const cleanPath = relativePath.replace(/^\.\//, '');

  // If it starts with /, it's relative to repo root
  if (cleanPath.startsWith('/')) {
    return `${assetUrlPrefix}${cleanPath}`;
  }

  // Otherwise, resolve relative to current file's directory
  const baseDir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/')) : '';
  const resolvedPath = baseDir ? `${baseDir}/${cleanPath}` : cleanPath;

  // Normalize path (handle ../)
  const normalized = normalizePath(resolvedPath);

  return `${assetUrlPrefix}/${normalized}`;
}

/**
 * Normalize a path by resolving .. and .
 */
function normalizePath(path: string): string {
  const parts = path.split('/').filter((p) => p && p !== '.');
  const result: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }

  return result.join('/');
}

// ============================================================================
// Preview Styles
// ============================================================================

/**
 * CSS for the Markdown preview
 */
export const previewStyles = `
  .markdown-preview {
    font-size: 1rem;
    line-height: 1.75;
    color: var(--foreground);
  }

  .markdown-preview h1,
  .markdown-preview h2,
  .markdown-preview h3,
  .markdown-preview h4,
  .markdown-preview h5,
  .markdown-preview h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.25;
  }

  .markdown-preview h1 { font-size: 2em; }
  .markdown-preview h2 { font-size: 1.5em; }
  .markdown-preview h3 { font-size: 1.25em; }
  .markdown-preview h4 { font-size: 1em; }

  .markdown-preview p {
    margin-bottom: 1em;
  }

  .markdown-preview a {
    color: var(--primary);
    text-decoration: underline;
  }

  .markdown-preview code {
    font-family: monospace;
    background: var(--border);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
  }

  .markdown-preview pre {
    background: var(--border);
    padding: 1em;
    border-radius: 6px;
    overflow-x: auto;
    margin-bottom: 1em;
  }

  .markdown-preview pre code {
    background: none;
    padding: 0;
  }

  .markdown-preview blockquote {
    border-left: 4px solid var(--border);
    padding-left: 1em;
    margin-left: 0;
    color: var(--muted);
  }

  .markdown-preview ul {
    margin-bottom: 1em;
    padding-left: 2em;
    list-style-type: disc;
  }

  .markdown-preview ol {
    margin-bottom: 1em;
    padding-left: 2em;
    list-style-type: decimal;
  }

  .markdown-preview li {
    margin-bottom: 0.25em;
    display: list-item;
  }

  .markdown-preview ul ul {
    list-style-type: circle;
  }

  .markdown-preview ul ul ul {
    list-style-type: square;
  }

  .markdown-preview img {
    max-width: 100%;
    height: auto;
    border-radius: 4px;
  }

  .markdown-preview table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
  }

  .markdown-preview th,
  .markdown-preview td {
    border: 1px solid var(--border);
    padding: 0.5em;
    text-align: left;
  }

  .markdown-preview th {
    background: var(--border);
    font-weight: 600;
  }

  .markdown-preview hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2em 0;
  }
`;
