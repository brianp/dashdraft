# Deployment Guide

This guide covers deploying DashDraft to production.

## Prerequisites

- Node.js 20+
- PostgreSQL database
- GitHub App created and configured

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/dashdraft?schema=public

# GitHub App
GITHUB_APP_ID=your-app-id
GITHUB_APP_CLIENT_ID=Iv1.xxxxx
GITHUB_APP_CLIENT_SECRET=xxxxx
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# Session (generate with: openssl rand -base64 32)
SESSION_SECRET=your-secure-session-secret-at-least-32-chars
```

## Deployment Options

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy

Vercel automatically handles:
- SSL/TLS certificates
- Edge caching
- Serverless function scaling

### Docker

Build and run the Docker image:

```bash
# Build
docker build -t dashdraft \
  --build-arg NEXT_PUBLIC_APP_URL=https://your-domain.com \
  .

# Run
docker run -p 3000:3000 \
  -e DATABASE_URL=... \
  -e GITHUB_APP_ID=... \
  -e GITHUB_APP_CLIENT_ID=... \
  -e GITHUB_APP_CLIENT_SECRET=... \
  -e GITHUB_APP_PRIVATE_KEY=... \
  -e GITHUB_WEBHOOK_SECRET=... \
  -e SESSION_SECRET=... \
  dashdraft
```

### Manual Deployment

```bash
# Install dependencies
npm ci

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Build
npm run build

# Start
npm start
```

## Database Setup

### Initial Setup

```bash
# Create database
createdb dashdraft

# Run migrations
npm run db:migrate

# (Optional) Seed data
npm run db:seed
```

### Migrations

When deploying updates with schema changes:

```bash
npm run db:migrate
```

## GitHub App Configuration

### Required Permissions

- **Repository contents**: Read and write
- **Pull requests**: Read and write
- **Metadata**: Read-only

### Callback URLs

Set these in your GitHub App settings:

- **Homepage URL**: `https://your-domain.com`
- **Callback URL**: `https://your-domain.com/api/auth/callback`
- **Webhook URL**: `https://your-domain.com/api/webhook` (optional)

### Installation

1. Install the GitHub App on repositories you want to edit
2. Users can install on their personal repos or organization repos

## Production Checklist

- [ ] SSL/TLS certificate configured
- [ ] Environment variables set
- [ ] Database migrated
- [ ] GitHub App configured with production URLs
- [ ] Rate limiting configured appropriately
- [ ] Logging and monitoring set up
- [ ] Backup strategy for database
- [ ] Error tracking (e.g., Sentry) configured

## Monitoring

### Health Check

The application exposes a health endpoint at `/api/health` (if implemented).

### Logs

In production, logs are output to stdout. Use your hosting platform's log aggregation.

### Metrics

Consider adding:
- Request latency tracking
- Error rate monitoring
- GitHub API rate limit monitoring
