# HOTFIX: Singleton Closure Bug

**Date:** 2026-01-05
**Severity:** CRITICAL
**Status:** ✅ FIXED

## Problem

After implementing the refactoring fixes to `SupabaseService`, the application stopped loading documents and document sets from Supabase.

### Symptoms

```
INFO: 172.22.0.1:34890 - "GET /agent/summaries HTTP/1.0" 200 OK
INFO: 172.22.0.1:34930 - "GET /agent/documentsets HTTP/1.0" 200 OK
INFO: 172.22.0.1:34918 - "GET /agent/documentsets HTTP/1.0" 200 OK
```

Requests returned 200 OK but with empty data.

### Log Evidence

```
2026-01-05 23:07:27,216 - INFO - Closed Supabase client connections.
2026-01-05 23:07:27,216 - INFO - VectorDBService closed successfully.
```

The Supabase client was being closed during normal operations!

## Root Cause

**Design Flaw:** Global singleton being closed by individual callers.

### The Architecture

```
VectorDBService (global singleton: db_service)
    ↓ uses
SupabaseService (global singleton: supabase_service)
    ↓ contains
httpx.Client (shared connection pool)
```

### The Problem

Multiple parts of the codebase were calling `.close()` on what they thought were "temporary" instances, but they were actually closing the shared global singleton:

**File 1: `file_watcher.py:58`**
```python
async def fetch_ids():
    temp_service = VectorDBService()  # Gets global singleton!
    try:
        docs = await temp_service.list_documents(limit=10000)
        return {d.payload.get("filename") for d in docs if d.payload}
    finally:
        await temp_service.close()  # ❌ Closes the GLOBAL singleton!
```

**File 2: `async_tasks.py:78`**
```python
async def _ingest_docs_async(files_data, use_vlm=False):
    try:
        # ... process files using db_service (global singleton)
        return "\n".join(results)
    finally:
        await db_service.close()  # ❌ Closes the GLOBAL singleton!
```

### What Happened

1. **App starts** → Supabase client initialized ✅
2. **WebSocket connects** → Triggers file watcher ⚠️
3. **File watcher** calls `fetch_ids()` → Closes global client ❌
4. **Subsequent requests** → Client is closed, returns empty data ❌

### Why It Worked Before

Before the refactoring:
- `VectorDBService.close()` was a no-op: `async def close(self): pass`
- Closing the "temporary" instance did nothing
- The bug existed but was masked

After the refactoring:
- `VectorDBService.close()` actually closes the Supabase client
- The bug became visible

## The Fix

### Changes Made

**File: `file_watcher.py`**

**Before:**
```python
async def fetch_ids():
    temp_service = VectorDBService()
    try:
        docs = await temp_service.list_documents(limit=10000)
        return {d.payload.get("filename") for d in docs if d.payload}
    finally:
        await temp_service.close()  # ❌ BAD
```

**After:**
```python
async def fetch_ids():
    # Use the global service instance (singleton pattern)
    # DO NOT close it - it's shared across the application
    temp_service = VectorDBService()
    docs = await temp_service.list_documents(limit=10000)
    return {d.payload.get("filename") for d in docs if d.payload}
    # Note: No close() call - the singleton is managed by the app lifecycle
```

**File: `async_tasks.py`**

**Before:**
```python
async def _ingest_docs_async(files_data, use_vlm=False):
    try:
        # ... process files
        return "\n".join(results)
    finally:
        await db_service.close()  # ❌ BAD
```

**After:**
```python
async def _ingest_docs_async(files_data, use_vlm=False):
    try:
        # ... process files
        return "\n".join(results)
    except Exception as e:
        logger.error(f"Ingestion task failed: {e}")
        raise
    # Note: DO NOT close db_service - it's a global singleton shared across tasks
    # In Celery workers, each process has its own copy, managed by worker lifecycle
```

## Singleton Pattern Best Practices

### ❌ WRONG: Closing a singleton in local scope

```python
def some_function():
    service = GlobalSingleton()  # Gets shared instance
    try:
        service.do_something()
    finally:
        service.close()  # ❌ Closes it for EVERYONE!
```

### ✅ CORRECT: Let the app lifecycle manage the singleton

```python
def some_function():
    service = GlobalSingleton()  # Gets shared instance
    service.do_something()
    # No close() - singleton lifecycle managed at app level
```

### ✅ CORRECT: Close only at application shutdown

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    yield
    # Shutdown
    await db_service.close()  # ✅ Close once when app shuts down
    logger.info("Shut down complete")
```

## Prevention

### Code Review Checklist

When reviewing code that uses global singletons:

- [ ] Does it call `.close()` on the singleton?
- [ ] Is the `.close()` in a local scope (function, try/finally)?
- [ ] Could this function be called multiple times?
- [ ] Would closing the singleton affect other parts of the app?

**Rule:** If the answer to any of these is YES, the close() call should be removed.

### Better Pattern: Dependency Injection

This bug highlights why dependency injection is better than global singletons:

**Current (Problematic):**
```python
# Global singleton
db_service = VectorDBService()

def my_function():
    db_service.do_something()  # Uses global
```

**Better (Dependency Injection):**
```python
def my_function(db_service: VectorDBService):
    db_service.do_something()  # Receives instance as parameter
```

With dependency injection:
- Clear ownership (caller manages lifecycle)
- Testable (can inject mocks)
- No hidden global state

## Related Issues

This relates to **Issue #2** from `REFACTORING_RECOMMENDATIONS.md`:
- Global Config Dependency (makes testing hard)
- Hidden singleton dependencies
- Unclear lifecycle management

**Recommendation:** Consider migrating to dependency injection pattern in future refactoring.

## Testing

### Manual Test

1. Start the application
2. Open WebSocket connection (triggers file watcher)
3. Query document sets: `GET /agent/documentsets`
4. Should return actual document sets, not empty array

### Expected Logs

**Before Fix:**
```
INFO - Closed Supabase client connections.  # ❌ Premature close
INFO - 172.22.0.1 - "GET /agent/documentsets HTTP/1.0" 200 OK
# Returns: {"document_sets": []}  # ❌ Empty
```

**After Fix:**
```
INFO - 172.22.0.1 - "GET /agent/documentsets HTTP/1.0" 200 OK
# Returns: {"document_sets": ["all", "project1", "project2"]}  # ✅ Data!
```

## Lessons Learned

1. **Refactoring reveals hidden bugs** - The empty `close()` was masking this issue
2. **Global singletons are dangerous** - Hard to track lifecycle
3. **Test after refactoring** - Even "safe" internal changes can have side effects
4. **Consider architectural patterns** - Dependency injection would prevent this

## Impact

**Severity:** CRITICAL
- App completely broken after refactoring
- No documents or document sets loaded
- Silent failure (200 OK with empty data)

**Fix Complexity:** LOW
- 2 files changed
- Removed inappropriate `.close()` calls
- Added explanatory comments

**Testing Required:**
- ✅ Syntax check: Passed
- ⏳ Manual test: Pending
- ⏳ Integration test: Pending

## Status

**Fixed:** 2026-01-05
**Files Modified:**
- `file_watcher.py` - Removed singleton close
- `async_tasks.py` - Removed singleton close

**Next Steps:**
1. Test the application
2. Verify documents and document sets load correctly
3. Consider refactoring to dependency injection (Issue #2)

---

**Related Documents:**
- [CRITICAL_FIXES_APPLIED.md](CRITICAL_FIXES_APPLIED.md) - Initial security fixes
- [REFACTORING_APPLIED.md](REFACTORING_APPLIED.md) - DRY and thread safety fixes
- [REFACTORING_RECOMMENDATIONS.md](services/REFACTORING_RECOMMENDATIONS.md) - Future improvements
