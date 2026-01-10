# Multi-Instance Deployment - Quick Reference

A cheat sheet for common operations and commands.

## 📋 Deployment Workflow (New Instance)

### 1. Pre-Flight Check
```bash
./scripts/deployment-checklist.sh tenant1
```

### 2. Setup VPS (First Time Only)
```bash
./scripts/setup-vps.sh <vps-ip>
```

### 3. Provision Instance
```bash
./scripts/provision-instance.sh tenant1 tenant1.example.com
```

### 4. Deploy Worker
```bash
./scripts/add-worker-to-vps.sh tenant1 <vps-ip> --deploy
```

### 5. Configure DNS
```
Type: CNAME
Name: tenant1
Value: cname.vercel-dns.com
TTL: 300
```

### 6. Verify Deployment
```bash
./scripts/verify-instance.sh tenant1 tenant1.example.com <vps-ip>
```

---

## 🔧 Common Operations

### Vercel Commands

```bash
# List all projects
vercel ls

# View environment variables
vercel env ls production --project python-agents-tenant1

# Add environment variable
vercel env add VARIABLE_NAME production --project python-agents-tenant1

# View deployment logs
vercel logs python-agents-tenant1

# Redeploy to production
vercel --prod --project python-agents-tenant1

# Add custom domain
vercel domains add tenant1.example.com --project python-agents-tenant1

# Remove custom domain
vercel domains rm tenant1.example.com --project python-agents-tenant1
```

### VPS Worker Commands

```bash
# SSH to VPS
ssh root@<vps-ip>

# View all workers
docker ps

# View logs for specific worker
docker logs worker-tenant1 -f

# View last 100 lines
docker logs worker-tenant1 --tail 100 -f

# Restart specific worker
docker restart worker-tenant1

# Restart all workers
cd /root/workers
docker-compose -f docker-compose.workers-multi.yml restart

# Stop all workers
docker-compose -f docker-compose.workers-multi.yml down

# Start all workers
docker-compose -f docker-compose.workers-multi.yml up -d

# Pull latest worker images
docker-compose -f docker-compose.workers-multi.yml pull

# Rebuild and restart
docker-compose -f docker-compose.workers-multi.yml up -d --force-recreate

# View worker environment variables
docker exec worker-tenant1 env | grep CELERY
docker exec worker-tenant1 env | grep SUPABASE
docker exec worker-tenant1 env | grep AZURE
```

### Celery Worker Commands

```bash
# Check worker status (via SSH to VPS)
docker exec worker-tenant1 celery -A async_tasks inspect active

# Ping worker
docker exec worker-tenant1 celery -A async_tasks inspect ping

# View registered tasks
docker exec worker-tenant1 celery -A async_tasks inspect registered

# Purge all tasks in queue
docker exec worker-tenant1 celery -A async_tasks purge
```

### Flower Monitoring

```bash
# Access Flower dashboard via SSH tunnel
ssh -L 5555:localhost:5555 root@<vps-ip>

# Then open browser to:
http://localhost:5555

# Login: admin:admin (or custom FLOWER_BASIC_AUTH)
```

---

## 🗄️ Database Operations

### Supabase

```bash
# View documents table
# Via Supabase Dashboard → Table Editor → documents

# Test vector search function
SELECT * FROM match_documents(
  '[0.1, 0.2, ...]'::vector,  -- Test embedding
  0.5,                         -- Similarity threshold
  10,                          -- Limit
  'test'                       -- Document set (or NULL)
);

# Count documents
SELECT COUNT(*) FROM documents;

# Count by document_set
SELECT document_set, COUNT(*) FROM documents GROUP BY document_set;

# View recent documents
SELECT filename, document_set, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

# Delete documents by set
DELETE FROM documents WHERE document_set = 'test';
```

### Azure Storage

```bash
# Install Azure CLI (if not installed)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# List containers
az storage container list --account-name tenant1storage

# List blobs in container
az storage blob list \
  --account-name tenant1storage \
  --container-name documents \
  --output table

# Download blob
az storage blob download \
  --account-name tenant1storage \
  --container-name documents \
  --name test/document.pdf \
  --file ./downloaded.pdf

# Delete blob
az storage blob delete \
  --account-name tenant1storage \
  --container-name documents \
  --name test/document.pdf
```

---

## 🔍 Troubleshooting Commands

### Frontend Not Loading

```bash
# Check DNS resolution
dig tenant1.example.com
nslookup tenant1.example.com

# Test HTTP connection
curl -I https://tenant1.example.com

# Test SSL certificate
echo | openssl s_client -servername tenant1.example.com -connect tenant1.example.com:443

# Check Vercel deployment status
vercel ls --project python-agents-tenant1
vercel logs python-agents-tenant1
```

### API Not Responding

```bash
# Test API health endpoint
curl https://tenant1.example.com/api/health

# Test API docs
curl -I https://tenant1.example.com/api/docs

# Check Vercel function logs
vercel logs python-agents-tenant1 --output raw | grep "/api/"

# Check environment variables
vercel env ls production --project python-agents-tenant1
```

### Worker Not Processing Tasks

```bash
# Check worker is running
ssh root@<vps-ip> "docker ps | grep tenant1"

# Check worker logs
ssh root@<vps-ip> "docker logs worker-tenant1 --tail 50"

# Check Celery connection
ssh root@<vps-ip> "docker exec worker-tenant1 celery -A async_tasks inspect ping"

# Check environment variables
ssh root@<vps-ip> "docker exec worker-tenant1 env | grep -E 'CELERY|SUPABASE|AZURE'"

# Check Redis connection (Upstash)
ssh root@<vps-ip> "docker exec worker-tenant1 python -c 'import redis; r = redis.from_url(\"$TENANT1_CELERY_BROKER_URL\"); print(r.ping())'"

# Restart worker
ssh root@<vps-ip> "docker restart worker-tenant1"
```

### Vector Search Not Working

```bash
# Check if pgvector extension is enabled
# Run in Supabase SQL Editor:
SELECT * FROM pg_extension WHERE extname = 'vector';

# Check if match_documents function exists
SELECT proname FROM pg_proc WHERE proname = 'match_documents';

# Check documents table exists
SELECT COUNT(*) FROM documents;

# Test manual vector search
SELECT content, filename, vector <-> '[0.1,0.2,...]'::vector AS distance
FROM documents
ORDER BY distance
LIMIT 5;
```

---

## 📊 Monitoring

### Health Checks

```bash
# Frontend health
curl https://tenant1.example.com

# API health
curl https://tenant1.example.com/api/health

# Worker health
ssh root@<vps-ip> "docker exec worker-tenant1 celery -A async_tasks inspect ping"

# Database connection (via worker)
ssh root@<vps-ip> "docker exec worker-tenant1 python -c 'from services.vector_db import vector_db_service; import asyncio; asyncio.run(vector_db_service.health_check())'"
```

### Resource Usage

```bash
# VPS disk usage
ssh root@<vps-ip> "df -h"

# VPS memory usage
ssh root@<vps-ip> "free -h"

# Docker disk usage
ssh root@<vps-ip> "docker system df"

# Container resource usage
ssh root@<vps-ip> "docker stats --no-stream"

# Clean up unused Docker resources
ssh root@<vps-ip> "docker system prune -a"
```

### Logs

```bash
# Vercel deployment logs
vercel logs python-agents-tenant1

# Worker logs
ssh root@<vps-ip> "docker logs worker-tenant1 -f"

# All workers logs
ssh root@<vps-ip> "cd /root/workers && docker-compose -f docker-compose.workers-multi.yml logs -f"

# Flower logs
ssh root@<vps-ip> "docker logs flower -f"
```

---

## 🔐 Security

### Rotate Credentials

```bash
# Rotate Supabase anon key
# 1. Generate new key in Supabase Dashboard → Settings → API
# 2. Update Vercel env var
vercel env rm SUPABASE_KEY production --project python-agents-tenant1
vercel env add SUPABASE_KEY production --project python-agents-tenant1

# 3. Update VPS .env file
ssh root@<vps-ip>
nano /root/workers/.env
# Update TENANT1_SUPABASE_KEY

# 4. Restart worker
docker restart worker-tenant1

# Rotate Azure Storage key
# 1. Regenerate key in Azure Portal → Storage Account → Access Keys
# 2. Update Vercel and VPS .env similarly
```

### Update Firewall

```bash
# View current rules
ssh root@<vps-ip> "ufw status"

# Allow specific IP for SSH
ssh root@<vps-ip> "ufw allow from <your-ip> to any port 22"

# Deny all other SSH
ssh root@<vps-ip> "ufw deny 22"

# Reload firewall
ssh root@<vps-ip> "ufw reload"
```

---

## 🚀 Scaling

### Add New Instance

```bash
# Complete workflow
./scripts/deployment-checklist.sh tenant2
./scripts/provision-instance.sh tenant2 tenant2.example.com
./scripts/add-worker-to-vps.sh tenant2 <vps-ip> --deploy
./scripts/verify-instance.sh tenant2 tenant2.example.com <vps-ip>
```

### Upgrade VPS

```bash
# Before upgrading, backup .env and docker-compose
ssh root@<vps-ip>
cd /root/workers
cp .env .env.backup
cp docker-compose.workers-multi.yml docker-compose.backup.yml

# After VPS resize/upgrade, restart services
docker-compose -f docker-compose.workers-multi.yml up -d
```

### Scale Workers Horizontally

```bash
# Run multiple workers for one tenant (for high load)
# Edit docker-compose.workers-multi.yml and add:

  worker-tenant1-2:
    image: ethanturk/python-agents-worker:latest
    container_name: worker-tenant1-2
    command: ["celery", "-A", "async_tasks", "worker", "--loglevel=info", "-Q", "tenant1_queue", "-n", "worker2@%h"]
    environment:
      # Same as worker-tenant1
    restart: unless-stopped
    networks:
      - workers
```

---

## 📝 Maintenance

### Update Worker Image

```bash
# On development machine
docker build -t ethanturk/python-agents-worker:latest .
docker push ethanturk/python-agents-worker:latest

# On VPS
ssh root@<vps-ip>
cd /root/workers
docker-compose -f docker-compose.workers-multi.yml pull
docker-compose -f docker-compose.workers-multi.yml up -d
```

### Update Vercel Deployment

```bash
# From repository
git pull
vercel --prod --project python-agents-tenant1
```

### Backup Configuration

```bash
# Backup VPS configuration
ssh root@<vps-ip> "cd /root/workers && tar czf ~/workers-backup-$(date +%Y%m%d).tar.gz ."
scp root@<vps-ip>:~/workers-backup-*.tar.gz ./backups/

# Backup Vercel env vars (manual export)
vercel env ls production --project python-agents-tenant1 > tenant1-env-backup.txt
```

---

## 🆘 Emergency Procedures

### Rollback Vercel Deployment

```bash
# View deployments
vercel ls --project python-agents-tenant1

# Rollback to specific deployment
vercel rollback <deployment-url> --project python-agents-tenant1
```

### Restart All Services

```bash
# VPS workers
ssh root@<vps-ip> "cd /root/workers && docker-compose -f docker-compose.workers-multi.yml restart"

# Vercel (redeploy)
vercel --prod --project python-agents-tenant1
```

### Full Recovery

```bash
# 1. Restore VPS configuration
scp ./backups/workers-backup-*.tar.gz root@<vps-ip>:~
ssh root@<vps-ip>
cd /root
tar xzf workers-backup-*.tar.gz -C /root/workers
cd /root/workers
docker-compose -f docker-compose.workers-multi.yml up -d

# 2. Restore Vercel deployment
vercel --prod --project python-agents-tenant1

# 3. Verify
./scripts/verify-instance.sh tenant1 tenant1.example.com <vps-ip>
```

---

## 📞 Support Resources

- **Full Documentation**: `docs/INSTANCE_SETUP.md`
- **Deployment Plan**: `/home/ethanturk/.claude/plans/elegant-stirring-hanrahan.md`
- **Example Configuration**: `examples/tenant1.env.example`
- **Scripts**: `scripts/` directory

---

## 💡 Tips & Best Practices

1. **Always test locally first**: Use Docker Compose locally before deploying to VPS
2. **Keep .env backed up**: Store in password manager (1Password, LastPass, etc.)
3. **Monitor costs**: Set up billing alerts in Vercel, Azure, Upstash
4. **Use staging environment**: Create tenant0.example.com for testing
5. **Document customizations**: Keep notes on per-tenant configurations
6. **Regular updates**: Update Docker images and npm packages monthly
7. **Security**: Rotate credentials quarterly, keep firewall rules tight
8. **Monitoring**: Check Flower dashboard weekly, review logs for errors

---

**Last Updated**: 2026-01-09
