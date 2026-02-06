# AI Drawer - Deployment Documentation

## Live URLs

- **Production**: https://ai-drawer.com
- **Render Dashboard**: https://dashboard.render.com (service: `ai-drawer`)
- **Supabase Dashboard**: https://supabase.com/dashboard/project/staukauuowzlrooepwfo
- **Cloudflare Dashboard**: https://dash.cloudflare.com (domain: `ai-drawer.com`)
- **GitHub Repo**: https://github.com/edward-cates/ai-drawer

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cloudflare    │────▶│     Render      │────▶│    Supabase     │
│   (DNS + CDN)   │     │  (Node server)  │     │  (Auth + DB)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Anthropic     │
                        │   (Claude API)  │
                        └─────────────────┘
```

## Services & Accounts

### 1. GitHub
- **Repo**: `edward-cates/ai-drawer`
- **CI/CD**: GitHub Actions runs tests on push to `main`
- **Auto-deploy**: Render watches this repo and deploys on push

### 2. Render (Hosting)
- **Service type**: Web Service
- **Runtime**: Node.js
- **Build command**: `npm install`
- **Start command**: `npm start`
- **Region**: (check dashboard)

### 3. Supabase (Database + Auth)
- **Project ref**: `staukauuowzlrooepwfo`
- **Region**: East US (North Virginia)
- **Database**: PostgreSQL with `designs` table
- **Auth**: Google OAuth enabled

### 4. Cloudflare (Domain + DNS)
- **Domain**: `ai-drawer.com`
- **DNS**: CNAME pointing to Render
- **Proxy**: Enabled (orange cloud) for SSL + CDN
- **SSL**: Full (strict)

### 5. Google Cloud (OAuth)
- **Project**: (check Google Cloud Console)
- **OAuth Client**: Web application
- **Authorized redirect URI**: `https://staukauuowzlrooepwfo.supabase.co/auth/v1/callback`

## Environment Variables

### Render (set in dashboard)
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com |
| `SUPABASE_URL` | `https://staukauuowzlrooepwfo.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anon key from Supabase dashboard → Settings → API |

### Supabase (set via CLI)
| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console → Credentials |

Set with: `supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx --project-ref staukauuowzlrooepwfo`

## Database Schema

```sql
-- designs table
create table designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled',
  document jsonb not null,
  thumbnail text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Row Level Security: users can only access their own designs
```

## How to Update

### Code changes
```bash
git add -A && git commit -m "Your message" && git push
# Render auto-deploys from main branch
```

### Database migrations
```bash
# Create migration file in supabase/migrations/
supabase db push
```

### Environment variables
- **Render**: Dashboard → Environment → Add/Edit → Save → Manual Deploy
- **Supabase secrets**: `supabase secrets set KEY=value --project-ref staukauuowzlrooepwfo`

## CLI Tools Used

```bash
# GitHub CLI
gh repo create
gh auth status

# Supabase CLI
supabase login
supabase projects list
supabase link --project-ref staukauuowzlrooepwfo
supabase db push
supabase secrets set

# Cloudflare CLI
wrangler login
wrangler whoami
```

## Costs

| Service | Plan | Cost |
|---------|------|------|
| Render | Free tier | $0 (750 hrs/month, sleeps after inactivity) |
| Supabase | Free tier | $0 (500MB DB, 50K auth users) |
| Cloudflare | Free tier | $0 |
| Domain | ai-drawer.com | ~$10/year |
| Anthropic | Pay-as-you-go | ~$0.015/1K input tokens, $0.075/1K output tokens (Opus) |

## Troubleshooting

### Site not updating after push
1. Check GitHub Actions for test failures
2. Check Render dashboard for deploy status
3. Try manual deploy in Render

### Auth not working
1. Verify `SUPABASE_ANON_KEY` is set in Render
2. Check Google OAuth redirect URI matches Supabase callback URL
3. Check Supabase Auth settings → Providers → Google is enabled

### Database issues
1. Check Supabase dashboard → Table Editor
2. Verify RLS policies are correct
3. Check Supabase logs for errors

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables
export ANTHROPIC_API_KEY=your-key
export SUPABASE_URL=https://staukauuowzlrooepwfo.supabase.co
export SUPABASE_ANON_KEY=your-anon-key

# Start dev server
npm run dev

# Run tests
make test
```
