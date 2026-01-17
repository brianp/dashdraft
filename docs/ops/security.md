# Security Guide

This document outlines the security architecture and best practices for DashDraft.

## Security Model

### Authentication

- **GitHub App OAuth**: Users authenticate via GitHub
- **Server-side sessions**: Session tokens stored in HTTP-only cookies
- **No client-side tokens**: GitHub installation tokens are never exposed to the browser

### Authorization

- **Installation-based access**: Users can only access repos where the GitHub App is installed
- **Explicit enablement**: Users must explicitly enable repos in their workspace
- **Server-side validation**: All repo access is validated server-side

### Data Flow

```
Browser → Next.js API → GitHub API
              ↓
         PostgreSQL
         (sessions, repo mappings)
```

- All GitHub API calls are made server-side
- Installation tokens are minted per-request and never stored
- Drafts are stored client-side in IndexedDB (not on server)

## Security Controls

### CSRF Protection

- Double-submit cookie pattern
- CSRF token required for all state-changing requests
- Tokens rotated regularly

### Rate Limiting

- Per-user rate limits on API endpoints
- Stricter limits on sensitive operations (auth, propose)
- In-memory token bucket (Redis for multi-instance)

### Input Validation

- Path traversal prevention with strict normalization
- Repository name validation
- Content size limits
- File type restrictions for assets

### Session Security

- HTTP-only cookies
- Secure flag in production
- SameSite=Lax
- 7-day expiration with sliding window

## Configuration

### Required Environment Variables

```bash
# Must be at least 32 characters
SESSION_SECRET=xxx

# GitHub App credentials (keep private!)
GITHUB_APP_PRIVATE_KEY=xxx
GITHUB_APP_CLIENT_SECRET=xxx
GITHUB_WEBHOOK_SECRET=xxx
```

### Secrets Management

**Do NOT**:
- Commit secrets to version control
- Log secrets
- Expose secrets in error messages
- Store secrets in client-side code

**Do**:
- Use environment variables
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate secrets regularly
- Use different secrets per environment

## Security Headers

The application sets these security headers:

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Content Security Policy

For the Markdown preview, consider adding a strict CSP:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.githubusercontent.com data:;
  connect-src 'self' https://api.github.com;
```

## Path Validation

All file paths are validated to prevent:

- Path traversal (`../`, `..%2f`)
- Absolute paths (`/etc/passwd`)
- Null byte injection
- Invalid characters

Allowed characters: `a-zA-Z0-9._-/`

## GitHub API Security

- Installation tokens are short-lived (1 hour)
- Tokens are minted per-request, not cached
- Minimal permissions requested
- No broad OAuth scopes

## Vulnerability Response

If you discover a security vulnerability:

1. **Do not** create a public issue
2. Email security@[your-domain] with details
3. Include steps to reproduce
4. Allow reasonable time for a fix before disclosure

## Audit Logging

Consider logging:

- Authentication events (login, logout)
- Failed authentication attempts
- PR creation events
- Permission changes

Example log format:
```json
{
  "timestamp": "2024-01-01T00:00:00Z",
  "event": "pr_created",
  "userId": "xxx",
  "repoFullName": "owner/repo",
  "prNumber": 42
}
```

## Hardening Checklist

- [ ] All environment variables configured
- [ ] Secrets not in version control
- [ ] HTTPS enforced
- [ ] Rate limiting enabled
- [ ] CSRF protection verified
- [ ] Session cookies properly configured
- [ ] Input validation tested
- [ ] Error messages don't leak sensitive info
- [ ] Logging configured (no sensitive data)
- [ ] Dependencies up to date (npm audit)
