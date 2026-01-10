# Traefik Setup Complete

Your Traefik reverse proxy configuration has been created for `aidocs.ethanturk.com`.

## What Was Created

### 1. Docker Compose File
- **File**: `docker-compose.traefik.yml`
- **Container**: Traefik v3.2 with Let's Encrypt support
- **Ports**: 80 (HTTP) and 443 (HTTPS)
- **Dashboard**: Available at `aidocs.ethanturk.com/traefik`

### 2. Configuration Files
- **`traefik/traefik.yml`**: Static configuration (ACME, entrypoints, logging)
- **`traefik/dynamic/routes.yml`**: Dynamic routes for Southhaven and Demo apps
- **`traefik/acme/acme.json`**: Let's Encrypt certificate storage (auto-generated)

### 3. Routing Configuration

#### Southhaven App
- Frontend: `https://aidocs.ethanturk.com/southhaven/`
- Backend API: `https://aidocs.ethanturk.com/southhaven/agent/`
- WebSocket: `https://aidocs.ethanturk.com/southhaven/ws`

#### Demo App
- Frontend: `https://aidocs.ethanturk.com/demo/`
- Backend API: `https://aidocs.ethanturk.com/demo/agent/`
- WebSocket: `https://aidocs.ethanturk.com/demo/ws`

## Before Starting Traefik

### 1. Update Let's Encrypt Email
Edit `traefik/traefik.yml` line 23:
```yaml
email: admin@ethanturk.com  # Change to your email
```

### 2. Change Dashboard Password
The default password is `changeme`. Generate a new one:  # pragma: allowlist secret
```bash
htpasswd -nb admin YourNewPassword
```
Copy the output and update `docker-compose.traefik.yml` line 34.

**Remember**: In docker-compose, use `$$` to escape `$` characters!

### 3. Update Frontend Environment Variables
Your `.env` file still references `aidocs.ethanturk.com`. Update it to:
```bash
VITE_API_BASE=https://aidocs.ethanturk.com/southhaven
```

### 4. Configure DNS
Point `aidocs.ethanturk.com` to your server's public IP:
```
aidocs.ethanturk.com  A  <your-public-ip>
```

### 5. Firewall Rules
Ensure ports 80 and 443 are open:
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## Starting Traefik

1. **Ensure backend/frontend services are running** on their respective ports:
   - Southhaven frontend: `192.168.5.204:3001`
   - Southhaven backend: `192.168.5.204:9998`
   - Demo frontend: `192.168.5.204:3002`
   - Demo backend: `192.168.5.204:9997`

2. **Start Traefik**:
   ```bash
   docker-compose -f docker-compose.traefik.yml up -d
   ```

3. **Monitor logs**:
   ```bash
   docker logs traefik -f
   ```

4. **Access the dashboard**:
   ```
   https://aidocs.ethanturk.com/traefik
   Username: admin
   Password: changeme (change this!)  # pragma: allowlist secret
   ```

## Verification Checklist

- [ ] DNS points to your server
- [ ] Ports 80/443 are open
- [ ] Let's Encrypt email is updated
- [ ] Dashboard password is changed
- [ ] Backend services are running
- [ ] Frontend `.env` updated to use `aidocs.ethanturk.com`
- [ ] Traefik container is running
- [ ] Certificate obtained (check logs)
- [ ] Can access `https://aidocs.ethanturk.com/southhaven/`
- [ ] Can access `https://aidocs.ethanturk.com/traefik`

## Troubleshooting

### Certificate Not Generated
```bash
# Check DNS
nslookup aidocs.ethanturk.com

# Check Traefik logs
docker logs traefik

# Retry by deleting acme.json
rm traefik/acme/acme.json
docker-compose -f docker-compose.traefik.yml restart
```

### Services Not Accessible
1. Verify services are running: `docker ps` or check ports with `netstat -tlnp | grep -E '3001|9998|3002|9997'`
2. Check Traefik dashboard for router status
3. Review access logs: `tail -f traefik/logs/access.log`

### WebSocket Issues
WebSocket upgrades are handled automatically. If issues persist:
1. Check browser console for connection errors
2. Verify WebSocket endpoint in frontend code matches Traefik routes
3. Ensure backend WebSocket handler is working

## Migrating from Nginx

If you're replacing the existing Nginx setup:

1. **Stop Nginx** to free ports 80/443:
   ```bash
   docker-compose -f docker-compose.proxy.yml down
   ```

2. **Start Traefik**:
   ```bash
   docker-compose -f docker-compose.traefik.yml up -d
   ```

3. **Test thoroughly** before removing Nginx configuration

## Next Steps

1. Test both Southhaven and Demo apps thoroughly
2. Monitor Let's Encrypt certificate renewal (automatic, but verify)
3. Set up log rotation for `traefik/logs/`
4. Consider adding rate limiting or IP whitelisting for the dashboard
5. Review security best practices in `traefik/README.md`

## Support

For detailed configuration options, see:
- `traefik/README.md` - Complete documentation
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)
