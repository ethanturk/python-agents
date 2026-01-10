# Multi-Instance Deployment Guide

This guide walks through deploying multiple isolated instances of the LangChain Agent System using Vercel for frontend/API and a shared VPS for Celery workers.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ISOLATED INSTANCES                        │
│                                                              │
│  tenant1.example.com  →  Vercel  →  Upstash Redis  →  VPS  │
│  tenant2.example.com  →  Vercel  →  Upstash Redis  →  VPS  │
│  tenant3.example.com  →  Vercel  →  Upstash Redis  →  VPS  │
│                                                              │
│  Each instance has:                                          │
│  - Dedicated Vercel project                                  │
│  - Dedicated Supabase database                               │
│  - Dedicated Azure Storage account                           │
│  - Dedicated Upstash Redis queue                             │
│  - Dedicated worker on shared VPS                            │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Development Machine

- **Vercel CLI**: `npm i -g vercel`
- **Git**: For cloning the repository
- **Bash**: For running provisioning scripts

### Cloud Services (Per Instance)

1. **Vercel Account** (free tier supports 5 projects)
2. **Supabase Project** (free tier: 500MB database)
3. **Azure Storage Account** (pay-as-you-go, ~$1-5/month)
4. **Upstash Redis** (free tier: 10k commands/day)
5. **OpenAI API Key** (can be shared across instances)
6. **Firebase Project** (optional, for authentication)

### Shared Infrastructure

1. **VPS Server** (Hetzner/DigitalOcean, $5-10/month)
   - 2 vCPU, 4GB RAM recommended
   - Docker installed
   - SSH access configured

## Cost Breakdown (Per Instance)

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Vercel | $0 (Hobby) | $20/month (Pro) |
| Supabase | $0 (500MB) | $25/month (8GB) |
| Azure Storage | ~$1-5/month | Same |
| Upstash Redis | $0.20-2/month | Same |
| **Subtotal** | **$1-7** | **$46-52** |

**Shared VPS**: $5-10/month total (all instances)

**Total for 5 instances**: $11-40/month (free tiers) or $236-260/month (paid tiers)

---

## Quick Start (Automated)

### Step 1: Prepare Cloud Resources

For each instance, create:

1. **Supabase Project**
   - Go to https://supabase.com
   - Create new project (e.g., `tenant1-db`)
   - Run the SQL schema (see [Supabase Setup](#supabase-setup))
   - Copy Project URL and anon key

2. **Azure Storage Account**
   - Go to https://portal.azure.com
   - Create storage account (e.g., `tenant1storage`)
   - Create container: `documents`
   - Copy connection string from "Access Keys"

3. **Upstash Redis**
   - Go to https://upstash.com
   - Create database (e.g., `tenant1-queue`)
   - Copy Redis URL

### Step 2: Run Provisioning Script

```bash
cd /path/to/python-agents

# Make scripts executable (first time only)
chmod +x scripts/*.sh

# Provision instance
./scripts/provision-instance.sh tenant1 tenant1.example.com

# Follow the prompts to enter:
# - Upstash Redis URL
# - Supabase URL and key
# - Azure Storage connection string
# - Azure Storage account name
# - OpenAI API key (optional, can be shared)
# - Firebase credentials (optional)
```

The script will:
- Create Vercel project `python-agents-tenant1`
- Configure all environment variables
- Deploy to production
- Add custom domain `tenant1.example.com`

### Step 3: Configure DNS

Add CNAME record in your DNS provider:

```
Type: CNAME
Name: tenant1
Value: cname.vercel-dns.com
TTL: 300
```

### Step 4: Add Worker to VPS

```bash
# Generate worker configuration
./scripts/add-worker-to-vps.sh tenant1 <vps-ip>

# Or auto-deploy (requires SSH access)
./scripts/add-worker-to-vps.sh tenant1 <vps-ip> --deploy
```

Then SSH to VPS and update `.env`:

```bash
ssh root@<vps-ip>
cd /root/workers
nano .env

# Add the credentials shown by the script
# Example:
TENANT1_CELERY_BROKER_URL=redis://...
TENANT1_OPENAI_API_KEY=sk-...
TENANT1_SUPABASE_URL=https://...
TENANT1_SUPABASE_KEY=eyJ...
TENANT1_AZURE_STORAGE_CONNECTION_STRING=Default...
TENANT1_AZURE_STORAGE_ACCOUNT_NAME=tenant1storage

# Save and exit (Ctrl+O, Enter, Ctrl+X)

# Restart workers
docker-compose -f docker-compose.workers-multi.yml up -d

# Verify worker is running
docker ps | grep tenant1
docker logs worker-tenant1 -f
```

### Step 5: Verify Deployment

1. **Check frontend**: https://tenant1.example.com
2. **Check API**: https://tenant1.example.com/api/health
3. **Check worker logs**: `docker logs worker-tenant1 -f`

---

## Detailed Setup Guides

### Supabase Setup

1. Create new project in Supabase Dashboard
2. Go to SQL Editor
3. Run the following schema:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  vector vector(1536),  -- Adjust if using different embedding model
  filename TEXT NOT NULL,
  document_set TEXT,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_document_set text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  filename text,
  document_set text,
  similarity float,
  metadata jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.filename,
    documents.document_set,
    1 - (documents.vector <=> query_embedding) AS similarity,
    documents.metadata
  FROM documents
  WHERE
    (filter_document_set IS NULL OR documents.document_set = filter_document_set)
    AND 1 - (documents.vector <=> query_embedding) > match_threshold
  ORDER BY documents.vector <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster vector search
CREATE INDEX IF NOT EXISTS documents_vector_idx
ON documents USING ivfflat (vector vector_cosine_ops)
WITH (lists = 100);

-- Create index on document_set for filtering
CREATE INDEX IF NOT EXISTS documents_document_set_idx
ON documents (document_set);
```

4. Go to Settings > API
5. Copy:
   - Project URL (e.g., `https://xxx.supabase.co`)
   - Anon/Public key (starts with `eyJhbGci...`)

### Azure Storage Setup

1. Go to Azure Portal (https://portal.azure.com)
2. Create new Storage Account:
   - Name: `tenant1storage` (must be globally unique)
   - Performance: Standard
   - Redundancy: LRS (cheapest)
   - Region: Choose closest to your users
3. After creation, go to Storage Account
4. Create container:
   - Go to "Containers" in left menu
   - Click "+ Container"
   - Name: `documents`
   - Public access level: Private
5. Copy connection string:
   - Go to "Access Keys" in left menu
   - Copy "Connection string" from key1 or key2

### Upstash Redis Setup

1. Go to Upstash Console (https://upstash.com)
2. Create new database:
   - Name: `tenant1-queue`
   - Type: Regional
   - Region: Choose closest to your VPS
3. After creation, copy the Redis URL:
   - Format: `redis://default:password@host:port`  <!-- pragma: allowlist secret -->
   - Example: `redis://default:xxx@us1-tenant1.upstash.io:12345`  <!-- pragma: allowlist secret -->

### VPS Setup (One-Time)

#### 1. Create VPS

**Hetzner Cloud** (Recommended for cost):
```bash
# Via Hetzner Cloud Console
# 1. Create new server
# 2. Location: Ashburn, VA (or closest to users)
# 3. Image: Ubuntu 24.04
# 4. Type: CX11 (2 vCPU, 4GB RAM, ~$5/month)
# 5. Add SSH key
# 6. Create server
```

**DigitalOcean** (Better documentation):
```bash
# Via DigitalOcean Console
# 1. Create Droplet
# 2. Choose Ubuntu 24.04
# 3. Size: Basic, $6/month (1 vCPU, 1GB RAM)
# 4. Add SSH key
# 5. Create Droplet
```

#### 2. Install Docker

```bash
# SSH to VPS
ssh root@<vps-ip>

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Enable Docker service
systemctl enable docker
systemctl start docker

# Verify installation
docker --version
docker-compose --version
```

#### 3. Setup Workers Directory

```bash
# Create directory
mkdir -p /root/workers
cd /root/workers

# Copy docker-compose.workers-multi.yml from repository
# Either clone the repo or copy the file manually
git clone https://github.com/yourusername/python-agents.git temp
cp temp/docker-compose.workers-multi.yml .
cp temp/.env.workers-multi.example .env
rm -rf temp

# Or create manually (see repository files)
```

#### 4. Configure Firewall

```bash
# Allow SSH (if not already allowed)
ufw allow 22/tcp

# Allow Flower (optional, for monitoring)
# Only if you want to access Flower without SSH tunnel
# ufw allow 5555/tcp

# Enable firewall
ufw enable
```

### Vercel Manual Setup (Alternative to Script)

If you prefer manual setup instead of using the provisioning script:

1. **Create project**:
   ```bash
   cd /path/to/python-agents
   vercel --name python-agents-tenant1
   ```

2. **Add environment variables** (via CLI or dashboard):
   ```bash
   # Required
   vercel env add CELERY_BROKER_URL production
   vercel env add CELERY_QUEUE_NAME production
   vercel env add SUPABASE_URL production
   vercel env add SUPABASE_KEY production
   vercel env add AZURE_STORAGE_CONNECTION_STRING production
   vercel env add AZURE_STORAGE_ACCOUNT_NAME production
   vercel env add OPENAI_API_KEY production
   vercel env add OPENAI_MODEL production
   vercel env add OPENAI_EMBEDDING_MODEL production
   vercel env add OPENAI_EMBEDDING_DIMENSIONS production

   # Optional
   vercel env add FIREBASE_PROJECT_ID production
   vercel env add FIREBASE_PRIVATE_KEY production
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Add custom domain**:
   ```bash
   vercel domains add tenant1.example.com
   ```

---

## Testing & Verification

### Frontend Test

```bash
curl https://tenant1.example.com
# Should return React app HTML
```

### API Health Check

```bash
curl https://tenant1.example.com/api/health
# Should return JSON health status
```

### Worker Health Check

```bash
# SSH to VPS
ssh root@<vps-ip>

# Check worker is running
docker ps | grep tenant1

# Check worker logs
docker logs worker-tenant1 -f

# Check Celery health
docker exec worker-tenant1 celery -A async_tasks inspect ping
```

### End-to-End Test

1. **Upload document** (via frontend or API)
2. **Trigger ingestion** (should queue task to Celery)
3. **Check worker logs** (should see task execution)
4. **Query Supabase** (should have new documents with embeddings)
5. **Test RAG query** (should return LLM response with context)

---

## Monitoring

### Flower Dashboard (Celery Monitoring)

```bash
# SSH tunnel to VPS
ssh -L 5555:localhost:5555 root@<vps-ip>

# Open browser
http://localhost:5555

# Login: admin:admin (or custom FLOWER_BASIC_AUTH)
```

### Vercel Logs

```bash
# View deployment logs
vercel logs python-agents-tenant1

# Or via dashboard
https://vercel.com/dashboard
```

### Docker Logs

```bash
# All workers
docker-compose -f docker-compose.workers-multi.yml logs -f

# Specific tenant
docker logs worker-tenant1 -f --tail 100

# Flower
docker logs flower -f
```

### Supabase Logs

```bash
# Via Supabase Dashboard
https://supabase.com/dashboard
# Select project → Logs → API / Postgres
```

---

## Troubleshooting

### Issue: Worker not processing tasks

**Check 1: Broker connection**
```bash
docker exec worker-tenant1 env | grep CELERY_BROKER_URL
# Should show correct Redis URL
```

**Check 2: Queue name**
```bash
docker exec worker-tenant1 env | grep CELERY_QUEUE_NAME
# Should match queue name in Vercel env vars
```

**Check 3: Worker status**
```bash
docker exec worker-tenant1 celery -A async_tasks inspect active
# Should show worker is alive
```

### Issue: Vercel deployment fails

**Check 1: Build logs**
```bash
vercel logs python-agents-tenant1
```

**Check 2: Environment variables**
```bash
vercel env ls production
# Verify all required vars are set
```

**Check 3: Redeploy**
```bash
vercel --prod --force
```

### Issue: Vector search not working

**Check 1: Supabase function exists**
```sql
SELECT proname FROM pg_proc WHERE proname = 'match_documents';
```

**Check 2: Vector extension enabled**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Check 3: Test function**
```sql
SELECT * FROM match_documents(
  '[0.1, 0.2, 0.3, ...]'::vector,  -- Test embedding
  0.5,  -- Threshold
  5,    -- Limit
  NULL  -- No document_set filter
);
```

### Issue: High costs

**Optimization 1: Use free tiers**
- Vercel Hobby plan (free, 5 projects)
- Supabase Free tier (500MB)
- Upstash free tier (10k commands/day)

**Optimization 2: Share OpenAI key**
- Use one API key across instances
- Track usage via metadata/tags

**Optimization 3: Optimize worker resources**
- Use smaller VPS if load is low
- Scale down during off-hours

---

## Scaling Beyond 5 Instances

### Option 1: Larger VPS
- Upgrade to 8GB RAM VPS ($20/month)
- Can run 10-15 workers

### Option 2: Multiple VPS
- Deploy workers across multiple VPS by region
- US VPS + EU VPS for global coverage

### Option 3: Kubernetes
- Migrate to K8s for auto-scaling
- Use managed K8s (GKE, EKS, AKS) or self-hosted (k3s)

### Option 4: Serverless Workers
- Replace Celery with AWS Lambda + SQS
- Pay-per-invocation model
- Higher latency, lower operational cost

---

## Maintenance

### Updating Worker Image

```bash
# On development machine, build and push new image
docker build -t ethanturk/python-agents-worker:latest .
docker push ethanturk/python-agents-worker:latest

# On VPS, pull and restart
ssh root@<vps-ip>
cd /root/workers
docker-compose -f docker-compose.workers-multi.yml pull
docker-compose -f docker-compose.workers-multi.yml up -d
```

### Updating Vercel Deployment

```bash
# From repository
cd /path/to/python-agents
git pull
vercel --prod
```

### Database Backups

**Supabase** (automatic):
- Free tier: Daily backups, 7-day retention
- Pro tier: Daily backups, point-in-time recovery

**Manual backup**:
```bash
# Export Supabase database
pg_dump "postgresql://postgres:password@host:5432/postgres" > backup.sql  # pragma: allowlist secret

# Upload to Azure Storage
az storage blob upload \
  --account-name tenant1storage \
  --container-name backups \
  --file backup.sql \
  --name "backup-$(date +%Y%m%d).sql"
```

---

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to git
2. **SSH Keys**: Use key-based authentication, disable password auth
3. **Firewall**: Only open necessary ports (22, optionally 5555)
4. **Secrets Rotation**: Rotate Supabase keys, Azure keys periodically
5. **Monitoring**: Set up alerts for unusual activity
6. **Updates**: Keep VPS system packages updated (`apt update && apt upgrade`)

---

## Next Steps

After setting up your first instance:

1. **Test thoroughly**: Upload documents, run queries, verify workers
2. **Document customizations**: Note any tenant-specific configurations
3. **Set up monitoring**: Configure alerts for downtime, errors
4. **Plan scaling**: Estimate growth and resource needs
5. **Automate further**: Create scripts for common operations

For additional instances, simply repeat the Quick Start process with different tenant IDs and subdomains.

---

## Support & Resources

- **Plan Document**: See `/home/ethanturk/.claude/plans/elegant-stirring-hanrahan.md`
- **Scripts**: See `/home/ethanturk/code/python-agents/scripts/`
- **Docker Compose**: See `/home/ethanturk/code/python-agents/docker-compose.workers-multi.yml`
- **Repository**: Check README.md and CLAUDE.md for project context

For issues or questions, refer to the troubleshooting section or check service-specific documentation (Vercel, Supabase, Upstash).
