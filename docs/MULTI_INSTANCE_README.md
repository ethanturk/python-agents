# Multi-Instance Deployment System

A cost-effective, scalable solution for deploying multiple isolated instances of the LangChain Agent System using Vercel, Supabase, Azure Storage, and a shared VPS for workers.

## 🎯 Overview

Deploy 2-5 isolated instances at **$11-40/month total** (using free tiers) or **$236-260/month** (production tiers).

Each instance includes:
- ✅ Dedicated Vercel project (frontend + serverless API)
- ✅ Dedicated Supabase database (vector storage)
- ✅ Dedicated Azure Storage account (file storage)
- ✅ Dedicated Upstash Redis queue (task queue)
- ✅ Dedicated Celery worker on shared VPS
- ✅ Custom subdomain (tenant1.example.com)

## 📁 Project Structure

```
python-agents/
├── docs/
│   ├── INSTANCE_SETUP.md          # Complete deployment guide
│   └── QUICK_REFERENCE.md          # Command cheat sheet
├── scripts/
│   ├── deployment-checklist.sh     # Pre-flight validation
│   ├── provision-instance.sh       # Vercel instance provisioning
│   ├── setup-vps.sh               # VPS initial setup
│   ├── add-worker-to-vps.sh       # Worker deployment
│   └── verify-instance.sh         # Post-deployment verification
├── examples/
│   └── tenant1.env.example        # Example environment configuration
├── backend/
│   ├── config.py                  # Redis broker support added
│   └── requirements.txt           # Redis dependencies added
├── docker-compose.workers-multi.yml   # Multi-tenant worker configuration
├── .env.workers-multi.example         # VPS environment template
└── MULTI_INSTANCE_README.md           # This file
```

## 🚀 Quick Start (30 Minutes)

### 1. Prerequisites Check
```bash
./scripts/deployment-checklist.sh tenant1
```

### 2. Create Cloud Resources
- **Supabase**: Create project, run SQL schema
- **Azure Storage**: Create account + container
- **Upstash Redis**: Create database

### 3. Setup VPS (One-Time, 10 min)
```bash
./scripts/setup-vps.sh <vps-ip>
```

### 4. Provision Instance (5 min)
```bash
./scripts/provision-instance.sh tenant1 tenant1.example.com
```

### 5. Deploy Worker (5 min)
```bash
./scripts/add-worker-to-vps.sh tenant1 <vps-ip> --deploy
ssh root@<vps-ip>
nano /root/workers/.env  # Add credentials
docker-compose -f docker-compose.workers-multi.yml up -d
```

### 6. Configure DNS (5 min)
```
Type: CNAME
Name: tenant1
Value: cname.vercel-dns.com
```

### 7. Verify Deployment (5 min)
```bash
./scripts/verify-instance.sh tenant1 tenant1.example.com <vps-ip>
```

## 💰 Cost Breakdown

### Per Instance (Free Tier)
| Service | Cost |
|---------|------|
| Vercel (Hobby) | $0 |
| Supabase (Free) | $0 |
| Azure Storage | $1-5 |
| Upstash Redis | $0.20-2 |
| **Subtotal** | **$1-7** |

### Shared Infrastructure
| Service | Cost |
|---------|------|
| VPS (Hetzner CX11) | $5 |
| Monitoring (free tiers) | $0 |
| **Total Shared** | **$5** |

### Total for 5 Instances
- **Free tiers**: $11-40/month
- **Production tiers**: $236-260/month

## 📚 Documentation

### Full Guides
- **[INSTANCE_SETUP.md](docs/INSTANCE_SETUP.md)** - Complete deployment walkthrough
- **[QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)** - Command cheat sheet
- **[Deployment Plan](/home/ethanturk/.claude/plans/elegant-stirring-hanrahan.md)** - Technical architecture

### Scripts

#### deployment-checklist.sh
Validates prerequisites before deployment:
- Checks local tools (Vercel CLI, Git, Docker)
- Verifies Vercel authentication
- Tests VPS connectivity
- Provides cloud resource checklist

#### provision-instance.sh
Automates Vercel deployment:
- Creates new Vercel project
- Configures environment variables
- Deploys to production
- Adds custom domain

#### setup-vps.sh
One-time VPS initialization:
- Installs Docker + Docker Compose
- Creates directory structure
- Copies configuration files
- Pulls worker images
- Configures firewall

#### add-worker-to-vps.sh
Deploys worker for new instance:
- Generates worker configuration
- Creates environment template
- Optionally deploys to VPS automatically

#### verify-instance.sh
End-to-end testing:
- DNS resolution
- Frontend accessibility
- API health checks
- Worker status
- Celery connectivity

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                  ┌────────▼─────────┐
                  │   DNS (CNAME)    │
                  │   tenant1.       │
                  │   example.com    │
                  └────────┬─────────┘
                           │
         ┌─────────────────▼────────────────────┐
         │        VERCEL PROJECT                 │
         │  - Static Frontend (React/Vite)      │
         │  - Serverless API (FastAPI+Mangum)   │
         │  - Environment Variables             │
         └─────┬──────────────────┬──────────────┘
               │                  │
     ┌─────────▼─────┐    ┌──────▼────────┐
     │  Supabase     │    │ Azure Storage │
     │  (Vector DB)  │    │ (Files)       │
     └───────────────┘    └───────────────┘
               │
         ┌─────▼──────┐
         │  Upstash   │
         │  Redis     │
         │  (Queue)   │
         └─────┬──────┘
               │
    ┌──────────▼───────────┐
    │  SHARED VPS          │
    │  - Worker tenant1    │
    │  - Worker tenant2    │
    │  - Worker tenant3    │
    │  - Flower (monitor)  │
    └──────────────────────┘
```

## 🔑 Key Features

### Instance Isolation
- Each tenant has dedicated database, storage, and queue
- No data sharing between instances
- Independent scaling and configuration

### Shared Infrastructure
- Single VPS runs all workers (~$5/month)
- Shared container registry (Docker Hub)
- Shared monitoring stack (optional)

### Cost Optimization
- Leverages free tiers (Vercel Hobby, Supabase Free)
- Serverless queue (Upstash) replaces expensive RabbitMQ
- Shared VPS reduces worker costs by 80%

### Automation
- Scripts reduce deployment time from 4-6 hours to 30 minutes
- Automated validation and verification
- One-command provisioning

## 📊 Monitoring & Management

### Access Points (per instance)

```bash
# Frontend
https://tenant1.example.com

# API Documentation
https://tenant1.example.com/api/docs

# Flower (Celery monitoring)
ssh -L 5555:localhost:5555 root@<vps-ip>
http://localhost:5555

# Worker Logs
docker logs worker-tenant1 -f

# Vercel Logs
vercel logs python-agents-tenant1
```

### Health Checks

```bash
# Quick health check
curl https://tenant1.example.com/api/health

# Full verification
./scripts/verify-instance.sh tenant1 tenant1.example.com <vps-ip>
```

## 🔧 Common Operations

### Add New Instance
```bash
./scripts/provision-instance.sh tenant2 tenant2.example.com
./scripts/add-worker-to-vps.sh tenant2 <vps-ip> --deploy
```

### Update Worker Image
```bash
# Build and push new image
docker build -t ethanturk/python-agents-worker:latest .
docker push ethanturk/python-agents-worker:latest

# Update VPS
ssh root@<vps-ip> 'cd /root/workers && docker-compose -f docker-compose.workers-multi.yml pull && docker-compose up -d'
```

### View All Workers
```bash
ssh root@<vps-ip> 'docker ps'
```

### Restart Worker
```bash
ssh root@<vps-ip> 'docker restart worker-tenant1'
```

See [QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) for comprehensive command list.

## 🛡️ Security

### Best Practices
- ✅ Never commit `.env` files to git
- ✅ Use SSH keys, disable password authentication
- ✅ Configure VPS firewall (UFW)
- ✅ Rotate credentials quarterly
- ✅ Use strong passwords for Flower dashboard
- ✅ Keep system packages updated

### Credential Storage
- Store `.env` files in password manager (1Password, LastPass)
- Backup worker configuration securely
- Document which credentials are shared vs per-tenant

## 🚨 Troubleshooting

### Frontend Not Loading
```bash
# Check DNS
dig tenant1.example.com

# Check Vercel deployment
vercel logs python-agents-tenant1

# Verify SSL
curl -I https://tenant1.example.com
```

### Worker Not Processing
```bash
# Check worker logs
docker logs worker-tenant1 -f

# Check Celery connection
docker exec worker-tenant1 celery -A async_tasks inspect ping

# Verify environment variables
docker exec worker-tenant1 env | grep CELERY_BROKER_URL
```

See [INSTANCE_SETUP.md](docs/INSTANCE_SETUP.md#troubleshooting) for detailed troubleshooting.

## 📈 Scaling

### Current Capacity
- 5 instances on single VPS (CX11: 2 vCPU, 4GB RAM)
- Light production workload per instance

### Scale Up Options

**Option 1: Larger VPS**
- Upgrade to CX21 (4 vCPU, 8GB) → 10-15 instances
- Cost: ~$10-15/month

**Option 2: Multiple VPS**
- Deploy regional VPS (US + EU)
- Better latency for global users

**Option 3: Kubernetes**
- Migrate to K8s for auto-scaling
- Use managed K8s (GKE, EKS) or self-hosted (k3s)

**Option 4: Serverless Workers**
- Replace Celery with AWS Lambda + SQS
- Pay-per-invocation model

## 🎓 Learning Resources

### Understanding the Stack

**Vercel (Frontend + API)**
- [Vercel Documentation](https://vercel.com/docs)
- [Deploying Python on Vercel](https://vercel.com/docs/frameworks/python)
- Mangum adapter for FastAPI on serverless

**Celery (Async Workers)**
- [Celery Documentation](https://docs.celeryq.dev/)
- [Using Redis as Broker](https://docs.celeryq.dev/en/stable/getting-started/backends-and-brokers/redis.html)

**Upstash Redis (Queue)**
- [Upstash Documentation](https://upstash.com/docs/redis/overall/getstarted)
- [Celery with Upstash](https://upstash.com/docs/redis/tutorials/celery_with_redis)

**Supabase (Vector DB)**
- [Supabase Docs](https://supabase.com/docs)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Vector Similarity Search](https://supabase.com/docs/guides/ai/vector-columns)

## 🤝 Contributing

### Reporting Issues
- Document the issue clearly with logs
- Include tenant ID and steps to reproduce
- Check troubleshooting guide first

### Suggesting Improvements
- Review existing architecture first
- Consider cost implications
- Test changes locally before proposing

## 📝 Changelog

### v1.0.0 (2026-01-09)
- Initial multi-instance deployment system
- Automated provisioning scripts
- Comprehensive documentation
- Cost-optimized architecture with shared VPS
- Support for 2-5 instances

## 🗺️ Roadmap

### Short-term (1-3 months)
- [ ] WebSocket → Server-Sent Events migration
- [ ] Grafana Cloud monitoring dashboards
- [ ] Automated backup scheduling
- [ ] Cost tracking per tenant

### Medium-term (3-6 months)
- [ ] Terraform/Pulumi IaC templates
- [ ] CI/CD per tenant
- [ ] Multi-region worker deployment
- [ ] Rate limiting per tenant

### Long-term (6-12 months)
- [ ] Kubernetes migration
- [ ] Multi-cloud support (AWS backup)
- [ ] White-label frontend customization
- [ ] Usage-based billing system

## 📞 Support

- **Documentation**: See `docs/` directory
- **Scripts**: See `scripts/` directory
- **Examples**: See `examples/` directory
- **Plan**: `/home/ethanturk/.claude/plans/elegant-stirring-hanrahan.md`

---

**Built with**: Vercel • Supabase • Azure • Upstash • Docker • Celery • FastAPI • React

**License**: See main repository LICENSE file

**Last Updated**: 2026-01-09
