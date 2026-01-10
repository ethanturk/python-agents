# Deployment Order Guide

This guide outlines the correct order to deploy multiple instances efficiently.

## 🎯 Prerequisites (Complete First)

Before deploying ANY instance, ensure you have:

### 1. Local Environment Setup
- [ ] Vercel CLI installed: `npm i -g vercel`
- [ ] Authenticated with Vercel: `vercel login`
- [ ] Repository cloned locally
- [ ] Scripts are executable: `chmod +x scripts/*.sh`

### 2. VPS Setup (Shared Across All Instances)
```bash
# Run once for all instances
./scripts/setup-vps.sh <vps-ip>
```

This sets up:
- Docker + Docker Compose
- /root/workers directory
- Base configuration files
- Firewall configuration

**Duration**: ~10 minutes (one-time)

---

## 📋 Instance 1 (Reference Instance)

The first instance takes longest because you're learning the process.

### Step 1: Create Cloud Resources (20-30 min)

#### Supabase
1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `tenant1-db`
4. Region: Choose closest to users
5. Wait for provisioning (~2 minutes)
6. Go to SQL Editor
7. Copy/paste schema from `docs/INSTANCE_SETUP.md` (Supabase Setup section)
8. Run the SQL
9. Go to Settings → API
10. Copy:
    - Project URL: `https://xxx.supabase.co`
    - Anon key: `eyJhbGci...`

#### Azure Storage
1. Go to https://portal.azure.com
2. Create → Storage Account
3. Name: `tenant1storage` (must be globally unique)
4. Performance: Standard
5. Redundancy: LRS
6. Region: Choose closest to users
7. Review + Create
8. Wait for deployment (~1 minute)
9. Go to storage account
10. Containers → + Container
11. Name: `documents`
12. Private access
13. Access Keys → key1
14. Copy Connection String

#### Upstash Redis
1. Go to https://console.upstash.com/redis
2. Create Database
3. Name: `tenant1-queue`
4. Type: Regional
5. Region: Choose closest to VPS
6. Create
7. Copy Redis URL: `redis://default:xxx@...`  <!-- pragma: allowlist secret -->

**Save all credentials in password manager NOW**

### Step 2: Run Pre-Flight Check (2 min)
```bash
./scripts/deployment-checklist.sh tenant1
```

Fix any issues before proceeding.

### Step 3: Provision Vercel Instance (5 min)
```bash
./scripts/provision-instance.sh tenant1 tenant1.example.com
```

When prompted, enter:
- Upstash Redis URL
- Supabase URL and key
- Azure connection string and account name
- OpenAI API key
- Firebase credentials (optional)

Script will:
- Create Vercel project
- Set environment variables
- Deploy to production
- Add custom domain

### Step 4: Configure DNS (5 min)

In your DNS provider (Cloudflare, Namecheap, etc.):

```
Type: CNAME
Name: tenant1
Value: cname.vercel-dns.com
TTL: 300
```

Wait 2-5 minutes for DNS propagation.

### Step 5: Deploy Worker (10 min)

```bash
# Generate and deploy worker config
./scripts/add-worker-to-vps.sh tenant1 <vps-ip> --deploy

# SSH to VPS
ssh root@<vps-ip>

# Edit .env file
cd /root/workers
nano .env

# Add these lines (using actual credentials):
TENANT1_CELERY_BROKER_URL=redis://default:xxx@...  # pragma: allowlist secret
TENANT1_OPENAI_API_KEY=sk-proj-xxx
TENANT1_SUPABASE_URL=https://xxx.supabase.co
TENANT1_SUPABASE_KEY=eyJhbGci...
TENANT1_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpoints...
TENANT1_AZURE_STORAGE_ACCOUNT_NAME=tenant1storage

# Save: Ctrl+O, Enter, Ctrl+X

# Start workers
docker-compose -f docker-compose.workers-multi.yml up -d

# Verify worker started
docker ps | grep tenant1
docker logs worker-tenant1 -f
```

### Step 6: Verify Deployment (5 min)

```bash
./scripts/verify-instance.sh tenant1 tenant1.example.com <vps-ip>
```

All checks should pass. If not, see troubleshooting in output.

### Step 7: Manual Testing (10 min)

1. Open browser: `https://tenant1.example.com`
2. Verify frontend loads
3. Check API docs: `https://tenant1.example.com/api/docs`
4. If using Firebase auth:
   - Log in
   - Upload test document
   - Verify upload successful
5. Check worker logs: `docker logs worker-tenant1 -f`
6. Verify document in Azure Storage
7. Check Flower: `ssh -L 5555:localhost:5555 root@<vps-ip>`, open `http://localhost:5555`

**Total Time: 60-80 minutes**

---

## 📋 Instance 2-5 (Replication)

After Instance 1, subsequent instances are much faster.

### Step 1: Create Cloud Resources (15 min)

You know the drill now. Create:
- Supabase project: `tenant2-db`
- Azure Storage: `tenant2storage`
- Upstash Redis: `tenant2-queue`

### Step 2: Provision (5 min)
```bash
./scripts/provision-instance.sh tenant2 tenant2.example.com
```

### Step 3: Configure DNS (5 min)
```
Type: CNAME
Name: tenant2
Value: cname.vercel-dns.com
```

### Step 4: Deploy Worker (5 min)
```bash
./scripts/add-worker-to-vps.sh tenant2 <vps-ip> --deploy
ssh root@<vps-ip>
nano /root/workers/.env  # Add TENANT2_* variables
docker-compose -f docker-compose.workers-multi.yml up -d
```

### Step 5: Verify (5 min)
```bash
./scripts/verify-instance.sh tenant2 tenant2.example.com <vps-ip>
```

**Total Time: 30-40 minutes per instance**

---

## 🔄 Parallel Deployment (Advanced)

If deploying multiple instances, you can parallelize some steps:

### Phase 1: Cloud Resources (Parallel)
Create all Supabase/Azure/Upstash resources in parallel:
- Open multiple browser tabs
- Create tenant1, tenant2, tenant3 resources simultaneously
- Save credentials as you go

**Time Saved: 20-30 minutes**

### Phase 2: Vercel Provisioning (Sequential)
Must be done one at a time:
```bash
./scripts/provision-instance.sh tenant1 tenant1.example.com
./scripts/provision-instance.sh tenant2 tenant2.example.com
./scripts/provision-instance.sh tenant3 tenant3.example.com
```

### Phase 3: DNS Configuration (Parallel)
Add all CNAME records at once in your DNS provider.

### Phase 4: Worker Deployment (Sequential)
Update .env and restart workers after adding all tenants:

```bash
# Add all workers
./scripts/add-worker-to-vps.sh tenant1 <vps-ip>
./scripts/add-worker-to-vps.sh tenant2 <vps-ip>
./scripts/add-worker-to-vps.sh tenant3 <vps-ip>

# SSH to VPS and update .env once
ssh root@<vps-ip>
nano /root/workers/.env
# Add all TENANT1_*, TENANT2_*, TENANT3_* variables

# Start all workers at once
docker-compose -f docker-compose.workers-multi.yml up -d
```

**Total Time for 3 instances: ~90 minutes** (vs 150 minutes sequential)

---

## 📊 Timeline Summary

### Instance 1 (Learning)
| Phase | Duration |
|-------|----------|
| Cloud Resources | 20-30 min |
| Pre-Flight Check | 2 min |
| Provision Vercel | 5 min |
| Configure DNS | 5 min |
| Deploy Worker | 10 min |
| Verify | 5 min |
| Manual Testing | 10 min |
| **Total** | **60-80 min** |

### Instances 2-5 (Experienced)
| Phase | Duration |
|-------|----------|
| Cloud Resources | 15 min |
| Provision Vercel | 5 min |
| Configure DNS | 5 min |
| Deploy Worker | 5 min |
| Verify | 5 min |
| **Total** | **30-40 min** |

### Full 5-Instance Deployment
- **Sequential**: 60 + (4 × 35) = **200 minutes** (~3.5 hours)
- **Parallel**: **120 minutes** (~2 hours)

---

## ✅ Post-Deployment Checklist

After deploying all instances:

### 1. Documentation
- [ ] Document all tenant IDs and subdomains
- [ ] Store all credentials in password manager
- [ ] Note any custom configurations per tenant
- [ ] Document which OpenAI key is used where

### 2. Monitoring Setup
- [ ] Set up Flower dashboard access
- [ ] Configure Grafana Cloud (optional)
- [ ] Set up Sentry error tracking (optional)
- [ ] Create billing alerts in Vercel/Azure/Upstash

### 3. Testing
- [ ] Verify all instances pass verification script
- [ ] Test upload → ingestion → query workflow per tenant
- [ ] Test authentication on each instance
- [ ] Verify worker logs show activity

### 4. Backup
- [ ] Backup VPS .env file to password manager
- [ ] Export Vercel environment variables
- [ ] Document VPS IP and SSH key location
- [ ] Save docker-compose configuration

### 5. Client Handoff (if applicable)
- [ ] Provide access credentials
- [ ] Share instance URLs
- [ ] Document how to upload files
- [ ] Explain monitoring dashboard access

---

## 🚨 Common Pitfalls

### Issue: Forgot to update VPS .env
**Symptom**: Worker starts but fails to connect

**Solution**:
```bash
ssh root@<vps-ip>
nano /root/workers/.env
# Add missing TENANT{N}_* variables
docker restart worker-tenant{N}
```

### Issue: DNS not propagating
**Symptom**: Frontend shows Vercel 404

**Solution**:
- Wait 5-10 minutes
- Check DNS: `dig tenant1.example.com`
- Verify CNAME points to `cname.vercel-dns.com`

### Issue: Worker starts but doesn't process tasks
**Symptom**: Tasks queue but never complete

**Solution**:
```bash
# Check queue name matches
docker exec worker-tenant1 env | grep CELERY_QUEUE_NAME
# Should be: tenant1_queue

# Check broker URL
docker exec worker-tenant1 env | grep CELERY_BROKER_URL
# Should match Upstash Redis URL

# Restart worker
docker restart worker-tenant1
```

### Issue: Supabase vector search fails
**Symptom**: Queries return empty results

**Solution**:
```sql
-- In Supabase SQL Editor
-- Check extension
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Check function
SELECT proname FROM pg_proc WHERE proname = 'match_documents';

-- If missing, re-run schema from INSTANCE_SETUP.md
```

---

## 🎓 Best Practices

1. **Start with one instance** - Master the process before scaling
2. **Document everything** - Future you will thank present you
3. **Use consistent naming** - tenant1, tenant2, etc.
4. **Test thoroughly** - Don't move to instance 2 until instance 1 works
5. **Keep credentials organized** - Use password manager with clear labels
6. **Monitor costs** - Set up billing alerts early
7. **Plan for growth** - Leave room in VPS for 1-2 more instances

---

**Ready to deploy?** Start with the pre-flight check:
```bash
./scripts/deployment-checklist.sh tenant1
```

Good luck! 🚀
