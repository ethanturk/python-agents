# Firebase Auth to Supabase Auth Migration Plan

## Overview

Migrate from Firebase Auth to Supabase Auth to remove heavy Firebase dependencies (~2.4MB) while maintaining Google OAuth authentication functionality.

**Migration Status**: ⚠️ Not Started
**Target Date**: TBD
**Estimated Effort**: 2-3 days

---

## Phase 1: Preparation & Analysis ✅

- [x] Analyze current Firebase Auth implementation
- [x] Research Supabase Auth capabilities
- [x] Document current dependencies and integration points
- [x] Create migration plan (this document)

### Current State Analysis

**Backend Dependencies**:
- `firebase-admin` (~2MB installed)
- `firebase-admin.auth` for token verification
- Firebase Admin initialization with Application Default Credentials

**Frontend Dependencies**:
- `firebase` package (~400KB in node_modules)
- Firebase Auth SDK for Google OAuth
- Firebase app configuration via env vars

**Integration Points**:
- `backend/auth.py` - `init_firebase()`, `get_current_user()`
- `frontend/src/firebase.js` - Firebase app initialization
- `frontend/src/contexts/AuthContext.jsx` - Google OAuth popup login
- `frontend/src/hooks/useAuth.js` - Auth context hook

---

## Phase 2: Supabase Configuration

### 2.1 Supabase Auth Setup

- [ ] Configure Google OAuth in Supabase Dashboard
  - [ ] Create Google Cloud OAuth client ID/secret
  - [ ] Add authorized redirect URIs (http://localhost:3000/auth/v1/callback)
  - [ ] Configure Google provider in Supabase
  - [ ] Test OAuth flow in Supabase console

- [ ] Configure Supabase Auth environment variables
  - [ ] Add `NEXT_PUBLIC_SUPABASE_URL` (already exists)
  - [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already exists)
  - [ ] Add `SUPABASE_SERVICE_ROLE_KEY` for backend verification
  - [ ] Update `.env.example` with new variables

### 2.2 Backend Configuration

- [ ] Update `backend/config.py`
  - [ ] Add `SUPABASE_SERVICE_ROLE_KEY` config variable
  - [ ] Remove `FIREBASE_REQUIRED` and related Firebase config

- [ ] Update `backend/requirements.txt`
  - [ ] Remove `firebase-admin` dependency
  - [ ] Ensure `supabase` package is present (already installed)

- [ ] Update Docker environment files
  - [ ] `docker-compose.yml` - Add Supabase service role key
  - [ ] Remove Firebase-related environment variables

---

## Phase 3: Backend Implementation

### 3.1 Replace Auth Module

- [ ] Create new `backend/auth_supabase.py`
  - [ ] Initialize Supabase client with service role key
  - [ ] Implement `init_supabase_auth()` function
  - [ ] Implement `get_current_user()` using `supabase.auth.verify_jwt()`
  - [ ] Add error handling for invalid tokens
  - [ ] Maintain same function signatures for compatibility

- [ ] Update `backend/backend_app.py`
  - [ ] Replace `from backend.auth import init_firebase, get_current_user`
  - [ ] With `from backend.auth_supabase import init_supabase_auth, get_current_user`
  - [ ] Update initialization call: `init_supabase_auth()`
  - [ ] Keep all endpoint dependencies unchanged (`dependencies=[Depends(get_current_user)]`)

- [ ] Delete or deprecate `backend/auth.py`
  - [ ] Add comment explaining migration
  - [ ] Keep file temporarily for reference if needed

### 3.2 Testing Backend Auth

- [ ] Write unit tests for `auth_supabase.py`
  - [ ] Test valid JWT token verification
  - [ ] Test invalid token handling
  - [ ] Test missing token handling
  - [ ] Mock Supabase client responses

- [ ] Run existing integration tests
  - [ ] Verify all protected endpoints still work
  - [ ] Test with valid Supabase JWT tokens
  - [ ] Verify error responses for invalid tokens

- [ ] Manual testing
  - [ ] Test token verification with real Supabase JWT
  - [ ] Verify user data extraction from token
  - [ ] Check error handling in logs

---

## Phase 4: Frontend Implementation

### 4.1 Replace Firebase SDK with Supabase Client

- [ ] Update `frontend/package.json`
  - [ ] Remove `firebase` dependency
  - [ ] Add `@supabase/supabase-js` dependency
  - [ ] Run `npm install` to update lockfile

- [ ] Create new `frontend/src/supabase.js`
  - [ ] Initialize Supabase client with URL and anon key
  - [ ] Export client for use across app
  - [ ] Match Firebase export pattern for easy replacement

- [ ] Delete `frontend/src/firebase.js`

### 4.2 Update Auth Context

- [ ] Rewrite `frontend/src/contexts/AuthContext.jsx`
  - [ ] Replace Firebase imports with Supabase imports
  - [ ] Initialize Supabase auth client
  - [ ] Replace `onAuthStateChanged` with `supabase.auth.onAuthStateChange`
  - [ ] Replace `signInWithPopup` with `supabase.auth.signInWithOAuth({ provider: 'google' })`
  - [ ] Replace `signOut` with `supabase.auth.signOut()`
  - [ ] Maintain same component API (currentUser, loginWithGoogle, logout)
  - [ ] Keep loading state and error handling

### 4.3 Update Components Using Auth

- [ ] Review all components using `useAuth()` hook
  - [ ] `frontend/src/components/NavBar.jsx` - Verify auth state usage
  - [ ] Other components - Verify no Firebase-specific code

- [ ] Update token handling in API calls
  - [ ] Check how tokens are passed to backend
  - [ ] Supabase provides access token via `session.access_token`
  - [ ] Ensure same Bearer token format is maintained

### 4.4 Update Frontend Environment Variables

- [ ] Update `frontend/.env` or `frontend/.env.local`
  - [ ] Remove Firebase variables (`VITE_FIREBASE_API_KEY`, etc.)
  - [ ] Add Supabase variables if not present
  - [ ] Ensure same naming as backend config

- [ ] Update `frontend/.env.example`
  - [ ] Document Supabase environment variables
  - [ ] Remove Firebase documentation

---

## Phase 5: Testing & Validation

### 5.1 Frontend Testing

- [ ] Unit tests for AuthContext
  - [ ] Test login flow
  - [ ] Test logout flow
  - [ ] Test auth state changes
  - [ ] Mock Supabase client

- [ ] Integration tests
  - [ ] Test full auth flow (login → protected API call)
  - [ ] Test token refresh handling
  - [ ] Test logout and session cleanup

- [ ] Manual testing in browser
  - [ ] Test Google OAuth login flow
  - [ ] Verify user is authenticated in UI
  - [ ] Test protected API access
  - [ ] Test logout functionality
  - [ ] Test session persistence (page reload)

### 5.2 Backend Testing

- [ ] Test all protected endpoints
  - [ ] Test with valid Supabase JWT
  - [ ] Test with expired/invalid tokens
  - [ ] Verify 401 responses

- [ ] Test user data extraction
  - [ ] Verify user ID, email, claims from token
  - [ ] Test with different user types

- [ ] Load testing (optional)
  - [ ] Verify token verification performance
  - [ ] Compare to Firebase performance

### 5.3 End-to-End Testing

- [ ] Full workflow test
  - [ ] User signs up via Google OAuth
  - [ ] User uploads document
  - [ ] User performs search
  - [ ] User logs out
  - [ ] Verify all operations work

- [ ] Session management test
  - [ ] Test session refresh
  - [ ] Test multiple tabs/windows
  - [ ] Test concurrent requests

---

## Phase 6: Deployment & Migration

### 6.1 Staging Deployment

- [ ] Deploy backend changes to staging
  - [ ] Update staging environment variables
  - [ ] Remove Firebase Admin service account
  - [ ] Deploy new auth module
  - [ ] Restart containers

- [ ] Deploy frontend changes to staging
  - [ ] Build with new dependencies
  - [ ] Update staging environment variables
  - [ ] Deploy new build
  - [ ] Clear cache/cookies in staging

- [ ] Smoke test staging environment
  - [ ] Test login flow
  - [ ] Test core functionality
  - [ ] Monitor logs for errors

### 6.2 Production Migration

- [ ] Pre-migration checks
  - [ ] Backup current Firebase Auth users
  - [ ] Document migration procedure
  - [ ] Prepare rollback plan

- [ ] Deploy to production
  - [ ] Deploy backend first
  - [ ] Deploy frontend second
  - [ ] Clear CDN cache
  - [ ] Monitor error rates

- [ ] Post-migration verification
  - [ ] Verify authentication works
  - [ ] Check user sessions
  - [ ] Monitor performance
  - [ ] Check error logs

### 6.3 User Migration (Optional/Advanced)

- [ ] **Note**: If existing Firebase users need migration
  - [ ] Export Firebase users via Admin SDK
  - [ ] Import to Supabase via `admin_api.createUser()`
  - [ ] Reset passwords or use OAuth re-authentication
  - [ ] Test migrated user access

---

## Phase 7: Cleanup & Documentation

### 7.1 Code Cleanup

- [ ] Remove Firebase-related code
  - [ ] Delete `backend/auth.py` (after verification)
  - [ ] Delete `frontend/src/firebase.js`
  - [ ] Remove any Firebase imports from other files
  - [ ] Clean up comments referencing Firebase

- [ ] Update documentation
  - [ ] Update `AGENTS.md` auth section
  - [ ] Update README if it mentions Firebase
  - [ ] Update API docs if needed

### 7.2 Update Configuration Files

- [ ] Update `.env.example`
  - [ ] Remove Firebase variables
  - [ ] Document Supabase variables

- [ ] Update `docker-compose.yml`
  - [ ] Remove Firebase environment variables
  - [ ] Clean up comments

### 7.3 Final Verification

- [ ] Run full test suite
  - [ ] `npm test` (frontend)
  - [ ] `pytest` (backend)
  - [ ] `pre-commit run --all-files`

- [ ] Final manual tests
  - [ ] Test complete user journey
  - [ ] Verify no Firebase references in UI
  - [ ] Check browser console for errors

- [ ] Create migration summary
  - [ ] Document changes made
  - [ ] Document any issues encountered
  - [ ] Provide rollback instructions

---

## Rollback Plan

If critical issues arise after migration:

1. **Immediate Actions**:
   - Revert `backend/backend_app.py` to use `auth.py`
   - Revert frontend to use Firebase SDK
   - Redeploy both services

2. **Restore Firebase Config**:
   - Restore Firebase environment variables
   - Ensure Firebase Admin credentials are available

3. **Verify Rollback**:
   - Test Firebase authentication works
   - Monitor logs for errors

---

## Migration Checklist Summary

### Backend
- [ ] Configure Supabase Auth
- [ ] Update `auth_supabase.py`
- [ ] Update `backend_app.py` imports
- [ ] Update environment variables
- [ ] Update `requirements.txt`
- [ ] Write tests
- [ ] Deploy and verify

### Frontend
- [ ] Update `package.json`
- [ ] Create `supabase.js`
- [ ] Rewrite `AuthContext.jsx`
- [ ] Update environment variables
- [ ] Test auth flow
- [ ] Deploy and verify

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing
- [ ] End-to-end testing
- [ ] Performance comparison

### Deployment
- [ ] Staging deployment
- [ ] Production deployment
- [ ] Post-deployment verification
- [ ] User migration (if needed)

### Cleanup
- [ ] Remove Firebase code
- [ ] Update documentation
- [ ] Final verification

---

## Notes & Considerations

### Token Differences
- Firebase tokens contain `uid`, Supabase uses `user_id`
- Firebase tokens use custom claims, Supabase uses `app_metadata` and `user_metadata`
- Token expiration may differ (Firebase: 1hr, Supabase: 1hr default, configurable)

### Session Management
- Firebase auto-refreshes tokens, Supabase requires explicit token refresh handling
- Supabase provides `session.refresh_token` for refresh flow

### Google OAuth Flow
- Firebase uses popup OAuth, Supabase can use popup or redirect
- Supabase Google OAuth requires additional configuration in Supabase dashboard

### Performance
- Expected improvement: Supabase token verification should be similar or faster
- Reduced bundle size: ~2.4MB removed from dependencies

### Cost
- Firebase: Free tier limited, pricing scales with MAU
- Supabase: Free tier 500MAU, pricing $25/50k MAU

---

## References

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Auth Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Python SDK](https://supabase.com/docs/reference/python)
- [Supabase JavaScript SDK](https://supabase.com/docs/reference/javascript)

---

## Progress Tracker

**Overall Progress**: 10% (Phase 1 complete)

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Preparation & Analysis | ✅ Complete | 100% |
| Phase 2: Supabase Configuration | ⏳ Not Started | 0% |
| Phase 3: Backend Implementation | ⏳ Not Started | 0% |
| Phase 4: Frontend Implementation | ⏳ Not Started | 0% |
| Phase 5: Testing & Validation | ⏳ Not Started | 0% |
| Phase 6: Deployment & Migration | ⏳ Not Started | 0% |
| Phase 7: Cleanup & Documentation | ⏳ Not Started | 0% |

---

**Last Updated**: 2026-01-09
**Next Phase**: Phase 2 - Supabase Configuration
