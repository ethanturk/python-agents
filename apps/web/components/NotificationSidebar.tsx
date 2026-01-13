import React from "react";
import { X, FileText, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface Notification {
  filename: string;
  read: boolean;
  result?: string;
  status: string;
  timestamp: number;
}

interface NotificationSidebarProps {
  open: boolean;
  onClose: () => void;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  activeSummaries?: string[];
  onDeleteCachedSummary: (filename: string) => void;
}

function NotificationSidebar({
  open,
  onClose,
  notifications,
  onNotificationClick,
  activeSummaries = [],
  onDeleteCachedSummary,
}: NotificationSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[350px] max-w-full">
        <SheetHeader className="border-b pb-4 mb-4">
          <SheetTitle>Notifications</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        <div className="space-y-4">
          {/* Active Summaries Section */}
          {activeSummaries.length > 0 && (
            <div>
              <p className="text-sm text-foreground/70 mb-2 font-medium">
                In Progress
              </p>
              <div className="space-y-2 mb-4">
                {activeSummaries.map((filename, index) => (
                  <div
                    key={`active-${index}`}
                    className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border"
                  >
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{filename}</p>
                      <p className="text-sm text-foreground/60">
                        Summarizing...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t pt-4 mb-2">
                <p className="text-sm text-foreground/70 mb-2 font-medium">
                  History
                </p>
              </div>
            </div>
          )}

          {/* Standard Notifications */}
          {notifications.length === 0 && activeSummaries.length === 0 && (
            <div className="p-4 text-center text-foreground/60">
              <p className="font-medium">No notifications</p>
              <p className="text-sm">Summaries will appear here when ready.</p>
            </div>
          )}

          {notifications.map((notif, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 p-3 rounded-lg border border-border cursor-pointer transition-colors hover:bg-muted/30",
                !notif.read && "bg-primary/10",
              )}
              onClick={() => onNotificationClick(notif)}
            >
              <FileText className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-foreground">
                  {notif.filename}
                </p>
                <p className="text-sm text-foreground/60">
                  {notif.result ? "Summary Ready" : `Status: ${notif.status}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCachedSummary(notif.filename);
                }}
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default NotificationSidebar;
