/**
 * AI Prompt Templates
 *
 * System prompts and templates for AI-assisted documentation features.
 * These prompts are designed to generate clean, well-structured markdown.
 */

// ============================================================================
// System Prompts
// ============================================================================

/**
 * Base system prompt establishing the AI's role
 */
export const BASE_SYSTEM_PROMPT = `You are a technical documentation assistant. Your role is to help users create clear, well-structured documentation in Markdown format.

Guidelines:
- Write in a clear, professional tone
- Use appropriate heading levels (start with ## for main sections, not #)
- Include practical examples where helpful
- Keep content focused and actionable
- Use bullet points and numbered lists for clarity
- Add code blocks with appropriate language tags when showing code

Format your responses as clean Markdown that can be directly used in documentation.`;

/**
 * System prompt for kickstart feature - generating initial document structure
 */
export const KICKSTART_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are helping a user start a new documentation file. Based on their description, generate a well-structured document outline with:
- A clear title (using ## heading)
- Logical sections with placeholder content
- Helpful comments or prompts in brackets [like this] where the user should add specific details
- Appropriate subsections based on the type of documentation

Keep the initial structure concise but complete enough to guide the user.`;

/**
 * System prompt for assist feature - helping stuck users
 */
export const ASSIST_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

You are helping a user who appears to be stuck while writing documentation. Provide helpful suggestions that:
- Continue naturally from where they left off
- Maintain consistency with their existing writing style
- Offer specific, actionable content (not generic advice)
- Are concise and easy to incorporate

Respond with just the suggested content - no explanations or meta-commentary.`;

// ============================================================================
// User Prompt Templates
// ============================================================================

/**
 * Generate the user prompt for kickstart requests
 */
export function buildKickstartPrompt(
  summary: string,
  context?: { repoName?: string; filePath?: string }
): string {
  let prompt = `Create a documentation outline for the following:

${summary}`;

  if (context?.repoName || context?.filePath) {
    prompt += '\n\nContext:';
    if (context.repoName) {
      prompt += `\n- Project: ${context.repoName}`;
    }
    if (context.filePath) {
      prompt += `\n- File path: ${context.filePath}`;
    }
  }

  return prompt;
}

/**
 * Generate the user prompt for assist requests
 */
export function buildAssistPrompt(
  content: string,
  cursorPosition?: number,
  assistType: 'continue' | 'improve' | 'explain' = 'continue'
): string {
  // Truncate content if too long, keeping context around cursor
  const maxContextLength = 3000;
  let contextContent = content;

  if (content.length > maxContextLength) {
    if (cursorPosition !== undefined) {
      // Keep content around cursor position
      const start = Math.max(0, cursorPosition - maxContextLength / 2);
      const end = Math.min(content.length, cursorPosition + maxContextLength / 2);
      contextContent = content.slice(start, end);
      if (start > 0) contextContent = '...\n' + contextContent;
      if (end < content.length) contextContent = contextContent + '\n...';
    } else {
      // Keep beginning and end
      const halfLength = maxContextLength / 2;
      contextContent =
        content.slice(0, halfLength) +
        '\n\n[...content truncated...]\n\n' +
        content.slice(-halfLength);
    }
  }

  const typeInstructions = {
    continue: 'Continue writing from where the document ends. Provide the next logical section or paragraph.',
    improve: 'Suggest improvements to make this documentation clearer and more helpful.',
    explain: 'Add explanations or examples to clarify the existing content.',
  };

  return `Here is the current documentation:

---
${contextContent}
---

${typeInstructions[assistType]}`;
}

// ============================================================================
// Response Processing
// ============================================================================

/**
 * Clean up AI response for insertion into editor
 */
export function cleanAIResponse(response: string): string {
  let cleaned = response.trim();

  // Remove any markdown code block wrapper if the AI wrapped the whole response
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.replace(/^```markdown\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```md')) {
    cleaned = cleaned.replace(/^```md\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    // Generic code block - only remove if it looks like it wraps the whole content
    const lines = cleaned.split('\n');
    if (lines[0] === '```' || lines[0]?.match(/^```\w*$/)) {
      cleaned = lines.slice(1, -1).join('\n');
    }
  }

  return cleaned.trim();
}
