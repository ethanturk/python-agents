# Design: React+Vite to Next.js 14 Migration Architecture

## Current State

### Project Structure (React+Vite)
```
frontend/
├── src/
│   ├── components/     # React components
│   ├── contexts/      # React Context API
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utilities and API client
│   ├── constants.ts     # App configuration
│   ├── config.ts        # Environment variables
│   ├── main.tsx        # React entry point
│   └── assets/         # Static assets
├── public/              # Static files
├── index.html           # Entry HTML
├── package.json         # Dependencies
└── vite.config.ts        # Vite configuration
```

### Current API Integration
```typescript
// config.ts
export const API_BASE = import.meta.env.VITE_API_BASE;

// API calls use axios
import axios from "axios";
const response = await axios.get(`${API_BASE}/agent/documents`);
```

### WebSocket Replaced with Polling
```typescript
// constants.ts
export const WEBSOCKET = {
  RECONNECT_DELAY: 3000,
  MAX_RECONNECT_ATTEMPTS: 10,
};

// Uses polling endpoint instead
const pollNotifications = async (sinceId: number) => {
  const response = await fetch(`${API_BASE}/poll?since_id=${sinceId}`);
  return response.messages;
};
```

## Proposed Architecture (Next.js 14)

### Project Structure (Next.js App Router)
```
/
├── frontend/                    # Next.js client app
│   ├── app/                 # App Router directory
│   │   ├── layout.tsx    # Root layout (wraps all pages)
│   │   ├── page.tsx      # Home page (SSR)
│   │   ├── documents/     # Documents features
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   ├── search/        # Search page
│   │   │   └── page.tsx
│   │   └── api/          # API routes (if needed)
│   │       └── notifications/route.ts
│   ├── components/          # React components (keep existing)
│   ├── lib/                # Utilities and API client
│   │   ├── api.ts        # API client
│   │   ├── utils.ts      # Shared utilities
│   │   └── hooks.ts      # Custom hooks (adapted)
│   ├── contexts/           # React Context (keep or adapt to App Router context)
│   ├── hooks/              # Keep existing hooks, add Next.js hooks
│   ├── constants.ts         # App constants
│   └── styles/            # Global styles
│   ├── public/             # Static files
│   └── package.json         # Dependencies
├── backend/                 # Serverless backend (existing)
│   ├── api/               # Vercel functions
│   └── services/           # Backend services
└── vercel.json            # Root Vercel config (monorepo)
```

### API Integration (Next.js)
```typescript
// lib/api.ts (adapted for Next.js)
import axios from "axios";

// Use process.env for server-side access
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ||
                (typeof window !== 'undefined' ? window.ENV.NEXT_PUBLIC_API_BASE : '');

export const apiClient = axios.create({
  baseURL: API_BASE,
});
```

### App Router Structure

**Root Layout:**
```typescript
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Title>Document Assistant</Title>
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <DocumentSetProvider>
            {children}
          </DocumentSetProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

**Feature-based Layouts:**
```
app/
├── layout.tsx              # Root layout with providers
├── page.tsx                # Home: document list + search
├── documents/
│   ├── layout.tsx           # Documents-specific layout
│   └── page.tsx            # Documents list page
├── search/
│   └── page.tsx            # Search page with SSR
└── (other routes as needed)
```

### Data Fetching Strategy

**Phase 1: Client-side data fetching (preserves current patterns)**
```typescript
// Keep existing hooks/useDocuments.ts
// Keep existing API calls with axios
// Minimal changes, just adapt imports and API_BASE
```

**Phase 2: Server-side data fetching (future enhancement)**
```typescript
// Future: Migrate to Server Actions
// Future: Use React Server Components where beneficial
```

### Monorepo Structure on Vercel

```
vercel.json
├── buildCommand: null      # Use package.json build scripts
├── frameworks:
│   - name: next.js
│     src: frontend
├── functions:
│   backend/api/**           # Backend serverless functions
└── routes:                  # Next.js routes (auto-detected)
```

## Component Migration

### Components to Keep As-Is
- **Radix UI components**: All existing components use Radix UI, which works in Next.js
- **UI components**: button, card, dialog, dropdown, select, etc.
- **Feature components**: DocumentListView, SearchView, UploadDialog, etc.

### Components to Adapt
- **API client**: Remove Vite-specific imports, use Next.js environment variables
- **Routing hooks**: Replace React Router navigation with Next.js router
- **Context providers**: Ensure they work in App Router context

## Migration Steps

### Phase 1: Project Setup
1. Initialize Next.js 14 project in `frontend/` directory
2. Copy dependencies and dev dependencies from package.json
3. Copy tsconfig.json and adapt for Next.js paths
4. Create vercel.json root config for monorepo

### Phase 2: Core Migration
1. Copy all components/ directory to new Next.js project
2. Create app/layout.tsx with providers (Auth, DocumentSet)
3. Create app/page.tsx as home page (migrate existing main.tsx content)
4. Copy and adapt lib/ directory (API client, utils)
5. Copy contexts/ directory
6. Copy hooks/ directory

### Phase 3: Route Migration
1. Map existing React Router routes to App Router pages:
   - `/` → `app/page.tsx`
   - `/documents` → `app/documents/page.tsx`
   - `/search` → `app/search/page.tsx`
   - (other routes as identified)
2. Create feature-based layouts where needed
3. Update navigation components to use Next.js router

### Phase 4: API Integration
1. Adapt API_BASE to work with Next.js environment variables
2. Update all API calls to use Next.js-compatible imports
3. Test server-side vs client-side API access

### Phase 5: Configuration
1. Set up environment variables for Next.js (NEXT_PUBLIC_*)
2. Create .env.example files for development and production
3. Configure Next.js build and optimization settings

### Phase 6: Testing
1. Test all user flows (auth, document upload, search)
2. Verify SSR doesn't break client-side features
3. Test WebSocket polling replacement works
4. Run build and test production bundle
5. Deploy to Vercel preview and verify

## Performance Considerations

### Build Optimization
- Next.js 14 includes automatic code splitting by route
- Keep tree-shaking optimizations from existing Vite config
- Use Next.js Image component for images (if any)
- Leverage React Server Components for reduced client JavaScript

### Caching Strategy
- Keep existing caching in hooks (summaries, document sets)
- Add Next.js fetch caching for API routes (if implemented)
- Use stale-while-revalidate pattern for data freshness

### Bundle Size Targets
- Aim for similar or smaller initial bundle size vs. Vite SPA
- Leverage dynamic imports for heavy features
- Use Next.js automatic splitting for route-based chunks

## Deployment Architecture

### Vercel Monorepo
```
Repository Root
├── frontend/          # Next.js application
│   ├── package.json
│   └── next.config.js
├── backend/           # Serverless Python functions
│   ├── api/
│   └── services/
└── vercel.json       # Root config for both
```

### vercel.json Configuration
```json
{
  "buildCommand": null,
  "installCommand": "cd frontend && npm install",
  "outputDirectory": "frontend/.next",
  "frameworks": [
    {
      "name": "nextjs",
      "src": "frontend"
    }
  ],
  "functions": {
    "backend/api/**": {
      "runtime": "python3.11"
    }
  }
}
```

## Trade-offs

### Pros
- **Better SEO**: SSR enables search engine indexing
- **Performance**: Automatic code splitting, image optimization, caching
- **Developer Tools**: Better debugging, image preview, route groups
- **Unified Deployment**: One Vercel project for both frontend and backend
- **Future-Ready**: Easy migration to Server Actions when ready

### Cons
- **Learning Curve**: Team needs to learn Next.js patterns
- **Build Time**: Next.js build may be slower than Vite initially
- **Complexity**: App Router has different patterns than React Router
- **Memory Usage**: Next.js development server may use more memory
- **Breaking Changes**: Routing and navigation need updates

## Risk Mitigation

### Migration Risks
1. **Runtime Errors**: Gradual migration with testing at each phase
2. **Missing Features**: Feature parity checklist before each phase
3. **Performance Regression**: Benchmark before and after migration
4. **Deployment Issues**: Test in preview environment before production

### Rollback Strategy
- Keep Vite SPA in separate branch for quick rollback
- Feature flags for gradual rollout if needed
- Document migration steps clearly for troubleshooting

## Open Questions

1. **SEO Requirements**: Which pages need SSR? (Most are auth-protected)
2. **Server Components**: Should we migrate to Server Components in Phase 2 or later?
3. **Middleware**: Need Next.js middleware for anything (auth, redirects)?
4. **ISR/SSG**: Any pages suitable for static generation or incremental static regeneration?
