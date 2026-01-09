# Security Guide

This document outlines the security measures implemented in the backend application and best practices for deployment.

## Security Fixes Applied

### 1. CORS Policy ✅ FIXED

**Issue:** Previously allowed ALL origins with `allow_origins=["*"]`, creating CSRF vulnerability.

**Fix:** Restricted to whitelisted origins via environment variable:
```python
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://aidocs.ethanturk.com
```

**Configuration:**
- Set `ALLOWED_ORIGINS` in `.env` file
- Comma-separated list of allowed origins
- Default: localhost:3000, localhost:3001, aidocs.ethanturk.com

### 2. Path Traversal Protection ✅ FIXED

**Issue:** User-controlled filenames in delete endpoint could allow access outside intended directory.

**Fix:** Implemented `safe_path_join()` function that:
- Extracts only the filename component (strips directory paths)
- Resolves absolute paths
- Validates final path is within base directory
- Raises HTTPException on path traversal attempts

**Example Attack Prevented:**
```python
# Attack attempt: /agent/documents/../../../etc/passwd
# Result: HTTPException 400 - "path traversal detected"
```

### 3. File Upload Validation ✅ FIXED

**Issue:** No validation on file size, type, or count.

**Fix:**
- **File size limit:** `MAX_FILE_SIZE` (default: 100MB)
- **File count limit:** `MAX_FILES_PER_UPLOAD` (default: 10)
- **Allowed extensions:** .pdf, .txt, .docx, .doc, .xlsx, .xls, .csv, .md, .json, .xml
- Files validated before writing to disk

**Configuration:**
```bash
MAX_FILE_SIZE=100000000        # 100MB in bytes
MAX_FILES_PER_UPLOAD=10
```

### 4. Resource Management ✅ FIXED

**Issue:** Database connections and cursors not properly closed, leading to resource leaks.

**Fix:** Implemented context managers:
```python
# Old (leaked resources):
conn = get_db_connection()
cursor = conn.cursor()
# ... if exception occurs, conn never closes

# New (automatic cleanup):
with get_db() as conn:
    cursor = conn.cursor()
    # ... automatic rollback on error, always closes
```

### 5. Authentication Fail-Fast ✅ FIXED

**Issue:** Application continued running even if Firebase auth initialization failed.

**Fix:** Added `FIREBASE_REQUIRED` environment variable:
- If `FIREBASE_REQUIRED=true`: App crashes on auth init failure (production)
- If `FIREBASE_REQUIRED=false`: Logs warning, continues (development)

**Configuration:**
```bash
FIREBASE_REQUIRED=true  # Production
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 6. Vector DB Connection Cleanup ✅ FIXED

**Issue:** `VectorDBService.close()` was empty, never closing httpx connections.

**Fix:** Implemented proper cleanup chain:
```python
VectorDBService.close() → SupabaseService.close() → httpx.Client.close()
```

## Security Best Practices

### Environment Variables

**Never commit these to git:**
```bash
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_KEY=eyJ...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

**Use `.env` files:**
1. Copy `.env.example` to `.env`
2. Fill in real values
3. `.env` is gitignored

### Firebase Authentication

**Production Setup:**
1. Create service account in Firebase Console
2. Download JSON key file
3. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
   export FIREBASE_REQUIRED=true
   ```

**Development Setup:**
```bash
export FIREBASE_REQUIRED=false  # Allows app to start without auth
```

### CORS Configuration

**Never use wildcards in production:**
```bash
# ❌ WRONG
ALLOWED_ORIGINS=*

# ✅ CORRECT
ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
```

**For development only:**
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### File Uploads

**Recommended limits:**
- Small documents: `MAX_FILE_SIZE=10000000` (10MB)
- Large documents: `MAX_FILE_SIZE=100000000` (100MB)
- Batch uploads: `MAX_FILES_PER_UPLOAD=10`

**Additional security (future enhancements):**
- Virus scanning (ClamAV)
- File type verification (magic bytes, not just extension)
- User upload quotas
- Rate limiting

### SQL Injection Prevention

**Already Implemented:** All database queries use parameterized statements:
```python
# ✅ SAFE - Parameterized
cursor.execute('SELECT * FROM summaries WHERE filename = ?', (filename,))

# ❌ UNSAFE - String interpolation (not used in this codebase)
cursor.execute(f'SELECT * FROM summaries WHERE filename = "{filename}"')
```

## Security Scanning

### Automated Tools

Run security scans before deployment:

```bash
# Install security tools
pip install -r requirements-dev.txt

# Run Bandit security scanner
bandit -r . -c .bandit

# Check for known vulnerabilities in dependencies
pip install safety
safety check

# Run all quality checks
make quality
```

### Pre-commit Hooks

Automatically run security checks on every commit:

```bash
# Install pre-commit
pip install pre-commit

# Setup hooks
pre-commit install

# Run manually
pre-commit run --all-files
```

## Deployment Checklist

Before deploying to production:

- [ ] Set `FIREBASE_REQUIRED=true`
- [ ] Configure `ALLOWED_ORIGINS` with production domains only
- [ ] Set strong `MAX_FILE_SIZE` and `MAX_FILES_PER_UPLOAD` limits
- [ ] Use environment-specific `.env` files (never commit secrets)
- [ ] Enable HTTPS (TLS/SSL certificates)
- [ ] Run `bandit -r .` and fix all HIGH/MEDIUM issues
- [ ] Review `OPENAI_API_KEY` - never use hardcoded defaults
- [ ] Configure rate limiting (slowapi or nginx)
- [ ] Set up monitoring/logging (Sentry, CloudWatch, etc.)
- [ ] Run `make ci` to verify all tests and quality checks pass

## Incident Response

If a security vulnerability is discovered:

1. **Assess severity** using CVSS scoring
2. **Isolate affected systems** if critical
3. **Apply patches** from this guide or security updates
4. **Review logs** for exploitation attempts
5. **Notify users** if data breach occurred
6. **Document** the incident and response

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Email security contact (add your email here)
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Python Security Best Practices](https://python.readthedocs.io/en/stable/library/security_warnings.html)
- [Bandit Documentation](https://bandit.readthedocs.io/)

## Version History

- **2026-01-05:** Initial security hardening
  - Fixed CORS policy
  - Added path traversal protection
  - Implemented file upload validation
  - Fixed resource management leaks
  - Added auth fail-fast mechanism
  - Implemented proper connection cleanup
