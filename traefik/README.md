# Traefik Reverse Proxy Configuration

This directory contains the Traefik configuration for routing traffic to the Southhaven and Demo applications.

## Overview

Traefik serves as a reverse proxy with automatic Let's Encrypt SSL certificates for `aidocs.ethanturk.com`.

## Services Configured

### Southhaven App
- **Frontend**: `aidocs.ethanturk.com/southhaven/` → `http://192.168.5.204:3001`
- **Backend API**: `aidocs.ethanturk.com/southhaven/agent/` → `http://192.168.5.204:9998`
- **WebSocket**: `aidocs.ethanturk.com/southhaven/ws` → `http://192.168.5.204:9998`

### Demo App
- **Frontend**: `aidocs.ethanturk.com/demo/` → `http://192.168.5.204:3002`
- **Backend API**: `aidocs.ethanturk.com/demo/agent/` → `http://192.168.5.204:9997`
- **WebSocket**: `aidocs.ethanturk.com/demo/ws` → `http://192.168.5.204:9997`

### Traefik Dashboard
- **URL**: `aidocs.ethanturk.com/traefik`
- **Default Credentials**:
  - Username: `admin`
  - Password: `changeme`  # pragma: allowlist secret
  - **⚠️ IMPORTANT: Change this password before deploying to production!**

## Directory Structure

```
traefik/
├── traefik.yml          # Static configuration (entrypoints, ACME, providers)
├── dynamic/             # Dynamic configuration (routes, services, middlewares)
│   └── routes.yml       # HTTP routes for all applications
├── acme/                # Let's Encrypt certificate storage
│   └── acme.json        # ACME certificate data (auto-generated)
├── logs/                # Traefik logs
│   ├── traefik.log      # General logs
│   └── access.log       # Access logs
└── README.md            # This file
```

## Setup Instructions

### 1. Update Email for Let's Encrypt

Edit `traefik/traefik.yml` and update the email address:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com  # Change this!
```

### 2. Change Dashboard Password

Generate a new password hash:

```bash
# Install htpasswd if not available
sudo apt-get install apache2-utils

# Generate password (replace 'yourpassword' with your actual password)
htpasswd -nb admin yourpassword
```

Update the password in `docker-compose.traefik.yml`:

```yaml
- "traefik.http.middlewares.dashboard-auth.basicauth.users=admin:$$apr1$$..."
```

**Note**: In docker-compose, `$` must be escaped as `$$`.

### 3. DNS Configuration

Ensure `aidocs.ethanturk.com` points to your server's public IP address:

```
aidocs.ethanturk.com  A  <your-server-ip>
```

### 4. Firewall Configuration

Open ports 80 and 443:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 5. Start Traefik

```bash
docker-compose -f docker-compose.traefik.yml up -d
```

### 6. Verify Setup

Check Traefik logs:

```bash
docker logs traefik -f
```

Access the dashboard:

```
https://aidocs.ethanturk.com/traefik
```

## Troubleshooting

### Certificate Issues

If Let's Encrypt certificate generation fails:

1. Check DNS is pointing correctly: `nslookup aidocs.ethanturk.com`
2. Ensure ports 80/443 are accessible from the internet
3. Check Traefik logs: `docker logs traefik`
4. Delete `acme/acme.json` and restart to retry

### Service Not Accessible

1. Verify backend services are running on the expected ports
2. Check Traefik dashboard for router/service status
3. Review `logs/access.log` for request routing

### Path Stripping Issues

The configuration strips `/southhaven` and `/demo` prefixes before forwarding to backend services. If your backend expects these prefixes, remove the `middlewares` section from the router configuration.

## Configuration Files

### Static Configuration (`traefik.yml`)
- Entry points (HTTP/HTTPS)
- Let's Encrypt configuration
- Logging settings
- Provider configuration

### Dynamic Configuration (`dynamic/routes.yml`)
- HTTP routers (URL matching rules)
- Services (backend endpoints)
- Middlewares (path stripping, auth, etc.)

## Security Notes

1. **Change the default dashboard password** before production deployment
2. Consider restricting dashboard access by IP address
3. Review access logs regularly
4. Keep Traefik updated for security patches
5. The `acme.json` file contains private keys - ensure it's not committed to git

## Updating Routes

To add new services or modify routes:

1. Edit `traefik/dynamic/routes.yml`
2. Traefik will automatically reload the configuration (watch mode enabled)
3. No restart required!

## Maintenance

### View Logs

```bash
# Real-time logs
docker logs traefik -f

# Access logs
tail -f traefik/logs/access.log

# Traefik logs
tail -f traefik/logs/traefik.log
```

### Restart Traefik

```bash
docker-compose -f docker-compose.traefik.yml restart
```

### Stop Traefik

```bash
docker-compose -f docker-compose.traefik.yml down
```
