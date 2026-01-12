"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  LogOut,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Search,
  FileText,
} from "lucide-react";
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
import { useAuth } from "../contexts/AuthContext";
import { useDocumentSet } from "../contexts/DocumentSetContext";
import { formatDocumentSetName } from "@/lib/utils";

// Removed props interface as we use routing now
interface NavBarProps {
  onShowNotifications?: () => void; // Keeping for future integration
  unreadCount?: number;
  loading?: boolean;
  showSuccess?: boolean;
}

export default function NavBar({
  onShowNotifications,
  unreadCount = 0,
  loading = false,
  showSuccess = false,
}: NavBarProps) {
  const { logout: logOut, currentUser: user } = useAuth();
  const { documentSets, selectedSet, setSelectedSet, fetchDocumentSets } =
    useDocumentSet();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDocumentSets();
    }
  }, [user, fetchDocumentSets]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await logOut();
      router.push("/");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  const navLinks = [
    { name: "Documents", href: "/", icon: FileText },
    { name: "Search", href: "/search", icon: Search },
    // Summarize and Notifications are likely modals or sidebars in the original design
    // If they were views, we'd add links here.
    // Assuming for now they might be separate pages or need refactoring.
    // For this migration, we'll keep Documents and Search as main pages.
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              AI Doc Search
            </span>
          </Link>
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
              aria-label="Refresh document sets"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <Button variant={isActive ? "secondary" : "ghost"}>
                    <Icon className="mr-2 h-4 w-4" />
                    {link.name}
                  </Button>
                </Link>
              );
            })}

            {/* Notifications Button - Keeping simplified for now */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onShowNotifications} // This needs parent to handle state or move to Context/Route
              className="relative"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            >
              {loading ? (
                <div className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : showSuccess ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
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
            <div className="flex items-center gap-2 ml-4 border-l border-border/80 pl-4">
              <span
                className="text-sm text-muted-foreground truncate max-w-[200px]"
                title={user?.email || ""}
              >
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
              >
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
              <nav className="flex flex-col gap-1 mt-4">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Button variant="ghost" className="justify-start w-full">
                        <Icon className="mr-2 h-4 w-4" />
                        {link.name}
                      </Button>
                    </Link>
                  );
                })}
                <div className="border-t border-border/50 my-3" />
                <div className="text-sm text-muted-foreground px-4 py-2 truncate">
                  {user?.email}
                </div>
                <Button
                  variant="ghost"
                  className="justify-start"
                  onClick={handleLogout}
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
