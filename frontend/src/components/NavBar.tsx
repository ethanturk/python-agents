import React, { useState, useEffect } from "react";
import {
  Menu,
  Bell,
  LogOut,
  RefreshCw,
  Loader2,
  CheckCircle2,
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

interface NavBarProps {
  onShowSearch: () => void;
  onShowDocuments: () => void;
  onShowSummarize: () => void;
  onShowNotifications: () => void;
  unreadCount: number;
  loading: boolean;
  showSuccess: boolean;
}

function NavBar({
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
              aria-label="Refresh document sets"
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
              aria-label={`Show notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
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
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
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

export default NavBar;
