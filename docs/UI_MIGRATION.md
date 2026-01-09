# UI Migration Guide: Material-UI → ShadCN UI

**Status**: Planning Phase
**Target Completion**: 6 weeks (1 developer)
**Estimated Effort**: 120-140 hours

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
3. [Migration Phases](#migration-phases)
4. [Rollback Procedures](#rollback-procedures)
5. [Risk Mitigation](#risk-mitigation)
6. [Success Metrics](#success-metrics)
7. [Timeline Summary](#timeline-summary)
8. [Appendices](#appendices)

---

## Executive Summary

### Current State
- **Component Count**: 13 React components
- **MUI Import Statements**: 44 across 13 files
- **Dependencies**: @mui/material, @mui/icons-material, @emotion/react, @emotion/styled
- **Dependency Footprint**: ~193MB in node_modules
- **Estimated Bundle Impact**: ~370-530KB gzipped
- **Build Time**: ~12 seconds

### Target State
- **UI Framework**: ShadCN UI with Tailwind CSS
- **Type System**: TypeScript (gradual migration from JSX)
- **Dependency Reduction**: ~193MB removed
- **Estimated Bundle Impact**: ~60-130KB gzipped (**40-60% reduction**)
- **Build Time**: ~7 seconds (**30-50% faster**)

### Key Challenges
1. **TypeScript Conversion**: Current project uses JSX, ShadCN requires TypeScript
2. **Custom Autocomplete**: MUI Autocomplete (UploadDialog) has no direct ShadCN equivalent
3. **Custom AppBar**: NavBar requires custom implementation (no ShadCN AppBar component)
4. **Theme Migration**: MUI ThemeProvider → Tailwind CSS variables
5. **Icon Library**: @mui/icons-material → lucide-react (smaller bundle)
6. **Testing Updates**: All test files need TypeScript conversion + new selectors

### Migration Timeline
**6 weeks** broken into phases:
- Week 1: Foundation & Simple Components
- Weeks 2-3: Core Infrastructure (NavBar, UploadDialog)
- Weeks 3-4: View Components (SearchView, SummarizeView, etc.)
- Weeks 4-5: Root Components & Contexts
- Weeks 5-6: Testing & Validation
- Week 6: Cleanup & Documentation

---

## Prerequisites & Environment Setup

### Step 1: TypeScript Configuration

#### Install TypeScript Dependencies
```bash
cd frontend
npm install -D typescript @types/react @types/react-dom @types/node
```

#### Create `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path Aliases for ShadCN */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

#### Create `tsconfig.node.json`
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Note**: Enable gradual migration by allowing `.jsx` and `.tsx` files to coexist.

---

### Step 2: Tailwind CSS Setup

#### Install Tailwind CSS
```bash
npm install tailwindcss @tailwindcss/vite
```

#### Create `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

#### Replace `src/index.css`
```css
@import "tailwindcss";

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

### Step 3: ShadCN UI Installation

#### Initialize ShadCN
```bash
pnpm dlx shadcn@latest init
```

**Prompts:**
- Style: Default
- Base color: Neutral (best for dark mode)
- CSS variables: Yes

This creates `components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

#### Install Required ShadCN Components
```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add select
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add alert
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add accordion
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add sheet
pnpm dlx shadcn@latest add toast
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add command
pnpm dlx shadcn@latest add scroll-area
pnpm dlx shadcn@latest add popover
```

This creates `src/components/ui/` directory with all components.

---

### Step 4: Update Vite Configuration

#### Rename `vite.config.js` → `vite.config.ts`

```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Check required environment variables
const requiredEnvVars = ["VITE_API_BASE", "VITE_FIREBASE_API_KEY"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0 && process.env.NODE_ENV !== "test") {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
    hmr: {
      overlay: false, // Docker memory optimization
    },
    watch: {
      usePolling: true, // Required for Docker
      interval: 2000,
    },
  },
  preview: {
    host: true,
    port: 3000,
  },
  build: {
    outDir: "dist",
    sourcemap: process.env.NODE_ENV !== "production",
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        passes: 2,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "firebase-vendor": ["firebase/app", "firebase/auth"],
          "markdown-vendor": ["react-markdown", "remark-gfm"],
          vendor: ["axios"],
        },
        entryFileNames: "assets/js/[name]-[hash].js",
        chunkFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: "assets/[ext]/[name]-[hash].[ext]",
      },
    },
    target: "es2020",
  },
  optimizeDeps: {
    include: ["react", "react-dom", "axios"],
  },
});
```

**Key Changes:**
- Added Tailwind plugin
- Added path alias resolution for `@/`
- Removed MUI-specific chunks from manualChunks

---

### Step 5: Git Strategy

#### Create Feature Branch
```bash
git checkout -b feature/shadcn-migration
git push -u origin feature/shadcn-migration
```

#### Create Phase Sub-branches
```bash
# Week 1
git checkout -b feature/shadcn-phase-1-foundation

# Week 2-3
git checkout -b feature/shadcn-phase-2-core

# etc.
```

#### Tag Before Major Changes
```bash
git tag pre-shadcn-migration
git push origin pre-shadcn-migration
```

---

## Migration Phases

### Phase 1: Foundation & Simple Components (Week 1)

**Goal**: Set up infrastructure and migrate 3 simple components to validate approach.

#### Step 1.1: Migrate Utilities to TypeScript

**File**: `src/utils.js` → `src/utils.ts`

```typescript
/**
 * Converts a file path to a web-accessible URL
 * Strips the monitored directory prefix
 */
export function getWebLink(filepath: string): string {
  if (!filepath) return "";
  const cleanPath = filepath.replace(/^\/data\/monitored\//, "");
  const apiBase = import.meta.env.VITE_API_BASE || "";
  return `${apiBase}/data/${cleanPath}`;
}

/**
 * Extracts just the filename from a full path
 */
export function getFilenameOnly(filepath: string): string {
  if (!filepath) return "";
  return filepath.split("/").pop() || filepath;
}

/**
 * Formats document set names for display
 * Converts to title case and handles special names
 */
export function formatDocumentSetName(name: string): string {
  if (!name) return "Unknown";
  if (name === "all") return "All Documents";
  if (name === "default") return "Default";

  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

**File**: `src/constants.js` → `src/constants.ts`

```typescript
// Time constants (milliseconds)
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

// WebSocket configuration
export const WEBSOCKET = {
  RECONNECT_DELAY: 3 * TIME.SECOND,
  MAX_RECONNECT_ATTEMPTS: 10,
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
  SUMMARY_STATE: "summarization_state",
  DOCUMENT_SET: "selected_document_set",
} as const;

// Summarization settings
export const SUMMARIZATION = {
  CACHE_EXPIRY: TIME.DAY,
  REQUEST_TIMEOUT: TIME.FIVE_MINUTES,
  MAX_RETRY_ATTEMPTS: 3,
} as const;

// Search settings
export const SEARCH = {
  MIN_QUERY_LENGTH: 2,
  DEFAULT_LIMIT: 25,
  DEBOUNCE_MS: 300,
} as const;

// Upload settings
export const UPLOAD = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  BATCH_SIZE: 64,
  ALLOWED_EXTENSIONS: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
    ".md",
  ] as const,
} as const;

// UI settings
export const UI = {
  SNACKBAR_DURATION: 6 * TIME.SECOND,
  LOADING_DEBOUNCE: 200,
  ANIMATION_DURATION: 300,
} as const;
```

**File**: `src/config.js` → `src/config.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  throw new Error(
    "VITE_API_BASE environment variable is required but not set. " +
    "Please check your .env file."
  );
}

export { API_BASE };
export default API_BASE;
```

---

#### Step 1.2: Migrate DeleteConfirmDialog

**File**: `src/components/DeleteConfirmDialog.tsx`

```typescript
import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getFilenameOnly } from "@/utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  filename: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmDialog({
  open,
  filename,
  onClose,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{" "}
            <strong>{getFilenameOnly(filename)}</strong>? This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Changes:**
- MUI `Dialog` → ShadCN `AlertDialog`
- MUI `Button` → ShadCN `AlertDialogAction`/`AlertDialogCancel`
- Added TypeScript interface for props
- Used ShadCN's destructive button styling

**Testing**:
```typescript
// src/components/DeleteConfirmDialog.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DeleteConfirmDialog from "./DeleteConfirmDialog";

describe("DeleteConfirmDialog", () => {
  it("renders with filename", () => {
    render(
      <DeleteConfirmDialog
        open={true}
        filename="/path/to/document.pdf"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/document.pdf/i)).toBeInTheDocument();
  });

  it("calls onConfirm when delete button clicked", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog
        open={true}
        filename="test.pdf"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(screen.getByText(/delete/i));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

**Estimated**: 1-2 hours

---

#### Step 1.3: Migrate FileDropZone

**File**: `src/components/FileDropZone.tsx`

```typescript
import React from "react";
import { useDropzone } from "react-dropzone";
import { CloudUpload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileDropZone({ onFilesSelected }: FileDropZoneProps) {
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setSelectedFiles(acceptedFiles);
      onFilesSelected(acceptedFiles);
    },
    multiple: true,
  });

  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${
            isDragActive
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25 hover:border-primary/50"
          }
        `}
      >
        <input {...getInputProps()} />
        <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop files here...</p>
        ) : (
          <div>
            <p className="text-lg font-medium mb-2">
              Drag & drop files here, or click to select
            </p>
            <p className="text-sm text-muted-foreground">
              Supports PDF, DOCX, XLSX, TXT, MD, and more
            </p>
          </div>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3">
            Selected Files ({selectedFiles.length})
          </h4>
          <ul className="space-y-2">
            {selectedFiles.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-2 rounded hover:bg-muted"
              >
                <span className="text-sm truncate flex-1">{file.name}</span>
                <span className="text-xs text-muted-foreground mx-2">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFile(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
```

**Changes:**
- MUI `Paper`, `Box`, `Typography` → Tailwind classes + ShadCN `Card`
- MUI icons → lucide-react icons (`CloudUpload`, `X`)
- Dynamic className composition for drag states
- Added TypeScript types

**Estimated**: 2-3 hours

---

#### Step 1.4: Migrate ErrorBoundary

**File**: `src/components/ErrorBoundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto mt-8 max-w-2xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              An unexpected error occurred. You can try resetting the component
              or reloading the page.
            </AlertDescription>
          </Alert>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <Card className="mt-4 p-4">
              <h3 className="font-semibold mb-2">Error Details:</h3>
              <pre className="text-xs overflow-auto bg-muted p-3 rounded">
                {this.state.error.toString()}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </Card>
          )}

          <div className="flex gap-2 mt-4">
            <Button onClick={this.handleReset}>Reset Component</Button>
            <Button variant="outline" onClick={this.handleReload}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**Changes:**
- MUI `Alert`, `Container` → ShadCN `Alert`, Tailwind classes
- Added lucide-react icon (`AlertCircle`)
- Proper TypeScript typing for class component

**Estimated**: 1-2 hours

---

#### Phase 1 Testing

```bash
# Run tests
npm test

# Check build
npm run build

# Verify both MUI and ShadCN work together
npm run dev
```

**Deliverables:**
- ✅ 3 components migrated to TypeScript + ShadCN
- ✅ Build validates successfully
- ✅ Tests passing
- ✅ Both UI systems coexist

---

### Phase 2: Core Infrastructure Components (Weeks 2-3)

**Goal**: Migrate the most complex components (NavBar, UploadDialog) that other components depend on.

#### Step 2.1: Migrate NavBar (Complex)

**Challenge**: MUI `AppBar` + responsive `Menu` + `useMediaQuery` has no direct ShadCN equivalent.

**Solution**: Custom sticky header with Tailwind + ShadCN Sheet for mobile.

**File**: `src/components/NavBar.tsx`

```typescript
import React, { useState, useEffect } from "react";
import { Menu, Bell, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDocumentSet } from "@/hooks/useDocumentSet";
import { formatDocumentSetName } from "@/utils";

interface NavBarProps {
  onShowSearch: () => void;
  onShowDocuments: () => void;
  onShowSummarize: () => void;
  onShowNotifications: () => void;
  unreadCount: number;
  loading: boolean;
  showSuccess: boolean;
}

export default function NavBar({
  onShowSearch,
  onShowDocuments,
  onShowSummarize,
  onShowNotifications,
  unreadCount,
  loading,
  showSuccess,
}: NavBarProps) {
  const { logout, currentUser } = useAuth();
  const { documentSets, selectedSet, setSelectedSet, fetchDocumentSets } =
    useDocumentSet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchDocumentSets();
    }
  }, [currentUser, fetchDocumentSets]);

  const handleNavClick = (action: () => void) => {
    action();
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 flex">
          <h1 className="text-lg font-bold">AI Doc Search</h1>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          {/* Document Set Selector */}
          <div className="flex items-center gap-2">
            <Select value={selectedSet} onValueChange={setSelectedSet}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Doc Set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {documentSets.map((ds) => (
                  <SelectItem key={ds} value={ds}>
                    {formatDocumentSetName(ds)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchDocumentSets}
              title="Refresh document sets"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Button variant="ghost" onClick={onShowSearch}>
              Search
            </Button>
            <Button variant="ghost" onClick={onShowDocuments}>
              Documents
            </Button>
            <Button variant="ghost" onClick={onShowSummarize}>
              Summarize
            </Button>

            {/* Notifications Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowNotifications}
              className="relative"
            >
              {loading ? (
                <div className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading</span>
                </div>
              ) : showSuccess ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-500">Done</span>
                </div>
              ) : (
                <>
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount}
                    </Badge>
                  )}
                </>
              )}
            </Button>

            {/* User Email & Logout */}
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <span className="text-sm text-muted-foreground">
                {currentUser?.email}
              </span>
              <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </nav>

          {/* Mobile Navigation */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-4">
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => handleNavClick(onShowSearch)}
                >
                  Search
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => handleNavClick(onShowDocuments)}
                >
                  Documents
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => handleNavClick(onShowSummarize)}
                >
                  Summarize
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={() => handleNavClick(onShowNotifications)}
                >
                  Notifications
                  {unreadCount > 0 && ` (${unreadCount})`}
                </Button>
                <div className="border-t my-2" />
                <div className="text-sm text-muted-foreground px-4 py-2">
                  {currentUser?.email}
                </div>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
```

**Key Changes:**
- MUI `AppBar` → Custom `<header>` with Tailwind sticky positioning
- MUI `Toolbar` → Tailwind flex container
- MUI `useMediaQuery` → Tailwind responsive classes (`hidden md:flex`)
- MUI `Menu` → ShadCN `Sheet` for mobile menu
- MUI `Select` → ShadCN `Select`
- MUI `Badge` → ShadCN `Badge`
- MUI `CircularProgress` → lucide-react `Loader2` with `animate-spin`
- MUI icons → lucide-react icons

**Estimated**: 6-8 hours

---

#### Step 2.2: Migrate UploadDialog (Complex)

**Challenge**: MUI `Autocomplete` with `freeSolo` has no direct ShadCN equivalent.

**Solution**: Custom autocomplete using ShadCN `Command` + `Popover`.

**File**: `src/components/DocumentSetAutocomplete.tsx` (custom component)

```typescript
import React, { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DocumentSetAutocompleteProps {
  documentSets: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export function DocumentSetAutocomplete({
  documentSets,
  value,
  onChange,
  loading = false,
}: DocumentSetAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleSelect = (currentValue: string) => {
    onChange(currentValue === value ? "" : currentValue);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setInputValue(search);
    // Allow creating new document set by typing
    if (!documentSets.includes(search)) {
      onChange(search);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={loading}
        >
          {value || "Select or create document set..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder="Search or type to create..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandEmpty>
            <div className="p-2 text-sm">
              Press Enter to create{" "}
              <strong className="text-primary">{inputValue}</strong>
            </div>
          </CommandEmpty>
          <CommandGroup>
            {documentSets.map((set) => (
              <CommandItem
                key={set}
                value={set}
                onSelect={() => handleSelect(set)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === set ? "opacity-100" : "opacity-0"
                  )}
                />
                {set}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**File**: `src/components/UploadDialog.tsx`

```typescript
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2 } from "lucide-react";
import { API_BASE } from "@/config";
import FileDropZone from "./FileDropZone";
import { DocumentSetAutocomplete } from "./DocumentSetAutocomplete";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

interface SuccessData {
  count: number;
  documentSet: string;
  isNewSet: boolean;
}

export default function UploadDialog({
  open,
  onClose,
  onUploadComplete,
}: UploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentSets, setDocumentSets] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState("");
  const [loadingSets, setLoadingSets] = useState(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  useEffect(() => {
    if (open) {
      fetchDocumentSets();
      setSelectedFiles([]);
      setError(null);
      setSelectedSet("");
      setSuccessData(null);
    }
  }, [open]);

  const fetchDocumentSets = async () => {
    setLoadingSets(true);
    try {
      const res = await axios.get(`${API_BASE}/agent/documentsets`);
      setDocumentSets(res.data.document_sets || []);
    } catch (e) {
      console.error("Failed to fetch document sets", e);
    } finally {
      setLoadingSets(false);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file.");
      return;
    }

    if (!selectedSet || selectedSet.trim() === "") {
      setError("Please select or enter a Document Set.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("document_set", selectedSet);

    try {
      await axios.post(`${API_BASE}/agent/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const isNew = !documentSets.includes(selectedSet);
      setSuccessData({
        count: selectedFiles.length,
        documentSet: selectedSet,
        isNewSet: isNew,
      });

      onUploadComplete();
    } catch (err: any) {
      console.error("Upload failed", err);
      setError(
        err.response?.data?.detail || "Upload failed. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleCloseSuccess = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={!uploading ? onClose : undefined}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Select files and assign them to a document set
          </DialogDescription>
        </DialogHeader>

        {successData ? (
          <div className="space-y-4 py-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Upload Successful!</AlertDescription>
            </Alert>
            <div className="text-center space-y-2">
              <p>
                <strong>{successData.count}</strong> file(s) have been uploaded.
              </p>
              <p>
                Document Set: <strong>{successData.documentSet}</strong>
                {successData.isNewSet && (
                  <span className="ml-2 text-xs text-green-500 border border-green-500 rounded px-2 py-1">
                    NEW
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Documents are scheduled for indexing and will be available
                shortly.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Document Set
              </label>
              <DocumentSetAutocomplete
                documentSets={documentSets}
                value={selectedSet}
                onChange={setSelectedSet}
                loading={loadingSets}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select existing or type a new one to create it
              </p>
            </div>

            <FileDropZone onFilesSelected={setSelectedFiles} />
          </div>
        )}

        <DialogFooter>
          {successData ? (
            <Button onClick={handleCloseSuccess}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || selectedFiles.length === 0}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Changes:**
- MUI `Autocomplete` → Custom `DocumentSetAutocomplete` (Command + Popover)
- MUI `Dialog` → ShadCN `Dialog`
- MUI `Alert` → ShadCN `Alert`
- MUI `CircularProgress` → lucide-react `Loader2`
- Added TypeScript interfaces

**Estimated**: 8-10 hours

---

#### Phase 2 Testing

```bash
# Unit tests
npm test

# Visual inspection
npm run dev
# Test NavBar responsive behavior (resize window)
# Test UploadDialog autocomplete (select existing, create new)
```

**Deliverables:**
- ✅ NavBar fully functional with mobile responsiveness
- ✅ UploadDialog with working custom Autocomplete
- ✅ All tests passing

---

### Phase 3: View Components (Weeks 3-4)

**Goal**: Migrate SearchView, SummarizeView, DocumentListView, NotificationSidebar.

*(Due to length constraints, showing abbreviated versions - full implementations follow similar patterns)*

#### SearchView.tsx

**Key Changes:**
- MUI `TextField` → ShadCN `Input`
- MUI `Select` → ShadCN `Select`
- MUI `Accordion` → ShadCN `Accordion`
- MUI `Paper` → ShadCN `Card`
- MUI `CircularProgress` → lucide-react `Loader2`
- Chat interface with Tailwind styling

**Estimated**: 6-8 hours

#### SummarizeView.tsx

**Key Changes:**
- MUI `Chip` → ShadCN `Badge` (for cached summaries)
- Form components similar to SearchView
- Chat interface preserved

**Estimated**: 6-8 hours

#### DocumentListView.tsx

**Key Changes:**
- MUI `Accordion` → ShadCN `Accordion`
- MUI `Paper` → ShadCN `Card`
- Button groups preserved

**Estimated**: 6-8 hours

#### NotificationSidebar.tsx

**Key Changes:**
- MUI `Drawer` → ShadCN `Sheet`
- Custom list with Tailwind
- Progress indicators preserved

**Estimated**: 4-6 hours

**Deliverables:**
- ✅ All 4 view components migrated
- ✅ Tests updated and passing
- ✅ UI matches previous design

---

### Phase 4: Root Components & Contexts (Weeks 4-5)

#### App.tsx

**Key Changes:**
- Remove MUI `ThemeProvider`, `CssBaseline`
- MUI `Container` → Tailwind `container` class
- MUI `Snackbar` → ShadCN `Toast` (using Sonner)
- Suspense fallbacks updated

**File**: `src/App.tsx`

```typescript
import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { Toaster, toast } from "sonner";
import "./App.css";
import { auth } from "./firebase";

import NavBar from "./components/NavBar";
import DeleteConfirmDialog from "./components/DeleteConfirmDialog";
import NotificationSidebar from "./components/NotificationSidebar";
import { useAuth } from "./hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Lazy load view components
const SearchView = lazy(() => import("./components/SearchView"));
const DocumentListView = lazy(() => import("./components/DocumentListView"));
const SummarizeView = lazy(() => import("./components/SummarizeView"));

// ... (hooks usage remains the same)

function App() {
  const { currentUser, loginWithGoogle } = useAuth();

  // ... (rest of logic)

  // Show toast instead of snackbar
  useEffect(() => {
    if (snackbarMessage) {
      toast.success(snackbarMessage);
    }
  }, [snackbarMessage]);

  if (!currentUser) {
    return (
      <div className="container mx-auto mt-8 max-w-sm">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Please Sign In</h2>
          <p className="mb-6">You need to be signed in to access the agent.</p>
          <Button onClick={loginWithGoogle} size="lg">
            Sign In with Google
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
      >
        Skip to main content
      </a>

      <NavBar {...navProps} />

      <NotificationSidebar {...sidebarProps} />

      <div className="container mx-auto mt-4 mb-8" id="main-content">
        {/* Offline indicator */}
        {!isOnline && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              No internet connection. Please check your network.
            </AlertDescription>
          </Alert>
        )}

        {/* WebSocket warning */}
        {showWsWarning && (
          <Alert className="mb-4">
            <AlertDescription>
              Real-time updates temporarily unavailable. Reconnecting...
            </AlertDescription>
          </Alert>
        )}

        {/* Views */}
        {view === "search" && (
          <Suspense fallback={<LoadingFallback />}>
            <SearchView {...searchProps} />
          </Suspense>
        )}

        {/* ... other views */}
      </div>

      <DeleteConfirmDialog {...deleteDialogProps} />

      <Toaster position="bottom-right" />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex justify-center items-center my-8">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

export default App;
```

**Estimated**: 4-6 hours

#### Contexts & Hooks Migration

Convert all contexts and hooks to TypeScript with proper types.

**Estimated**: 6-9 hours total (2-3 hours per context, 1 hour per hook)

**Deliverables:**
- ✅ Complete TypeScript codebase
- ✅ Zero MUI dependencies in use
- ✅ All integration tests passing

---

### Phase 5: Testing & Validation (Weeks 5-6)

#### Unit Test Migration

Update all test files to TypeScript with new component selectors.

**Estimated**: 8-12 hours

#### Performance Validation

```bash
# Production build
npm run build

# Measure bundle size
du -sh dist/assets/*.js | sort -h

# Lighthouse audit
npx lighthouse http://localhost:3000 --view
```

**Success Criteria:**
- Bundle size <200KB gzipped
- Lighthouse Performance >90
- Build time <8s

#### Visual Regression Testing

Use Percy or Chromatic for automated visual diffs.

**Estimated**: 4-6 hours setup

**Deliverables:**
- ✅ All tests passing in TypeScript
- ✅ Performance metrics validated
- ✅ Accessibility compliance confirmed

---

### Phase 6: Cleanup & Documentation (Week 6)

#### Remove MUI Dependencies

```bash
npm uninstall @mui/material @mui/icons-material @emotion/react @emotion/styled
```

#### Install Icon Library

```bash
npm install lucide-react
```

#### Icon Migration

| MUI Icon | Lucide Icon |
|----------|-------------|
| `MenuIcon` | `Menu` |
| `SearchIcon` | `Search` |
| `DeleteIcon` | `Trash2` |
| `SendIcon` | `Send` |
| `DescriptionIcon` | `FileText` |
| `CloudUploadIcon` | `CloudUpload` |
| `RefreshIcon` | `RefreshCw` |
| `CheckCircleIcon` | `CheckCircle2` |
| `ErrorIcon` | `AlertCircle` |
| `NotificationsIcon` | `Bell` |
| `LogoutIcon` | `LogOut` |
| `ArticleIcon` | `FileText` |
| `CloseIcon` | `X` |
| `ExpandMoreIcon` | `ChevronDown` |
| `InsertDriveFileIcon` | `File` |

#### Code Cleanup

- Remove `theme.js`
- Remove MUI CSS from `App.css`
- Update documentation

**Estimated**: 4-6 hours

**Deliverables:**
- ✅ Zero MUI dependencies
- ✅ Documentation updated
- ✅ Production-ready codebase

---

## Rollback Procedures

### Immediate Rollback (<5 minutes)

```bash
git checkout main
git branch -D feature/shadcn-migration
npm install
```

### Partial Rollback (Per Phase)

Each phase is committed separately. Cherry-pick successful migrations:

```bash
git checkout feature/shadcn-migration
git log --oneline  # Find commit hash
git cherry-pick <commit-hash>
```

### Zero Data Loss Guarantee

- No database schema changes
- No API changes
- All changes are frontend-only
- LocalStorage keys unchanged

---

## Risk Mitigation

### High-Risk Components

1. **UploadDialog (Custom Autocomplete)**
   - Mitigation: Prototype separately before integration
   - Fallback: Keep MUI Autocomplete temporarily
   - Estimated: 8-10 hours

2. **NavBar (Custom AppBar)**
   - Mitigation: Test on multiple devices early
   - Fallback: Desktop-only version first
   - Estimated: 6-8 hours

### Quality Gates

**Cannot Proceed If:**
- Tests failing
- Build errors present
- Performance regression >10%
- Accessibility score drops below 95
- Bundle size increases

### Mitigation Strategies

- **WebSocket Integration**: Extensive integration testing
- **Firebase Auth**: Test early and often
- **Responsive Design**: Test on real devices (iOS, Android)

---

## Success Metrics

### Technical Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Bundle Size (gzipped) | ~500KB | <200KB | Pending |
| Build Time | ~12s | <8s | Pending |
| Lighthouse Performance | ~75 | >90 | Pending |
| Lighthouse Accessibility | 100 | 100 | Pending |
| Test Coverage | >80% | >80% | Pending |

### Business Metrics

- ✅ Zero production downtime during migration
- ✅ No user-facing bugs reported
- ✅ Feature parity maintained
- ✅ Responsive design works on all devices

### Code Quality Metrics

- ✅ TypeScript strict mode enabled
- ✅ Zero ESLint errors
- ✅ Zero console warnings in production

---

## Timeline Summary

| Week | Phase | Key Activities | Hours |
|------|-------|----------------|-------|
| 1 | Foundation | Setup + simple components | 20-25 |
| 2-3 | Core Components | NavBar, UploadDialog | 25-30 |
| 3-4 | Views | SearchView, SummarizeView, etc. | 30-35 |
| 4-5 | Root & Contexts | App, contexts, hooks | 20-25 |
| 5-6 | Testing | Performance, accessibility | 20-25 |
| 6 | Cleanup | Dependencies, docs | 5-10 |
| **Total** | | | **120-150 hours** |

---

## Appendices

### Appendix A: Complete Component Mapping

| MUI Component | ShadCN Equivalent | Migration Notes |
|---------------|-------------------|-----------------|
| `Button` | `Button` | Direct replacement, similar API |
| `IconButton` | `Button variant="ghost" size="icon"` | Use variant props |
| `TextField` | `Input` | Simpler API, no variant prop |
| `Select` | `Select` | Similar API with Radix primitives |
| `Dialog` | `Dialog` | Radix-based, similar patterns |
| `Snackbar` | `Toast` (Sonner) | Hook-based API: `toast.success()` |
| `Alert` | `Alert` | Direct replacement |
| `CircularProgress` | lucide `Loader2` + `animate-spin` | Use icon with Tailwind animation |
| `Autocomplete` | `Command` + `Popover` | Custom implementation required |
| `Accordion` | `Accordion` | Direct replacement |
| `Drawer` | `Sheet` | Similar slide-in behavior |
| `Menu` | `DropdownMenu` | Different API but similar UX |
| `Badge` | `Badge` | Direct replacement |
| `Chip` | `Badge` | Use Badge with rounded styling |
| `Typography` | Tailwind classes | No component needed: `text-lg`, `font-bold`, etc. |
| `Box` | `div` + Tailwind | No component needed: `flex`, `gap-4`, etc. |
| `Container` | `div` + Tailwind `container` | Use: `<div className="container mx-auto">` |
| `Paper` | `Card` | Similar elevation/shadow concept |
| `AppBar` | Custom component | No direct equivalent, use sticky header |
| `Toolbar` | Tailwind flex classes | No component needed |
| `ThemeProvider` | Not needed | CSS variables handle theming |
| `CssBaseline` | Not needed | Tailwind base styles |

### Appendix B: Icon Migration Map

Complete mapping from @mui/icons-material to lucide-react:

```typescript
// Before (MUI)
import MenuIcon from '@mui/icons-material/Menu';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';

// After (Lucide)
import { Menu, Trash2, Search } from 'lucide-react';
```

### Appendix C: Tailwind Utility Equivalents

| MUI `sx` Prop | Tailwind Class |
|---------------|----------------|
| `sx={{ display: 'flex' }}` | `className="flex"` |
| `sx={{ gap: 2 }}` | `className="gap-2"` |
| `sx={{ mt: 4 }}` | `className="mt-4"` |
| `sx={{ p: 2 }}` | `className="p-2"` |
| `sx={{ bgcolor: 'background.paper' }}` | `className="bg-card"` |
| `sx={{ color: 'text.secondary' }}` | `className="text-muted-foreground"` |
| `sx={{ borderRadius: 2 }}` | `className="rounded-lg"` |
| `sx={{ fontWeight: 'bold' }}` | `className="font-bold"` |

### Appendix D: TypeScript Quick Reference

**Component Props:**
```typescript
interface ComponentProps {
  title: string;
  count?: number;  // Optional
  onClick: () => void;
  children: React.ReactNode;
}
```

**Hook Return Types:**
```typescript
function useCustomHook(): {
  data: Data[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  // implementation
}
```

**Context Types:**
```typescript
interface AuthContextType {
  currentUser: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
```

---

## Resources

- [ShadCN UI Documentation](https://ui.shadcn.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Lucide Icons](https://lucide.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Testing](https://vitest.dev/)

---

**Document Version**: 1.0
**Created**: 2026-01-09
**Last Updated**: 2026-01-09
**Status**: Planning Phase
