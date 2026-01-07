import React from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArticleIcon from "@mui/icons-material/Article";
import DeleteIcon from "@mui/icons-material/Delete";

function NotificationSidebar({
  open,
  onClose,
  notifications,
  onNotificationClick,
  activeSummaries = [],
  onDeleteCachedSummary,
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        role="presentation"
        sx={{
          width: "350px",
          maxWidth: "100vw",
        }}
      >
        <Box
          sx={{
            padding: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <Typography variant="h6">Notifications</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <List>
          {/* Active Summaries Section */}
          {activeSummaries.length > 0 && (
            <>
              <ListItem sx={{ pb: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  In Progress
                </Typography>
              </ListItem>
              {activeSummaries.map((filename, index) => (
                <React.Fragment key={`active-${index}`}>
                  <ListItem
                    sx={{
                      borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                    }}
                  >
                    <CircularProgress size={20} sx={{ marginRight: 2 }} />
                    <ListItemText
                      primary={filename}
                      secondary="Summarizing..."
                    />
                  </ListItem>
                </React.Fragment>
              ))}
              <Divider sx={{ my: 1 }} />
              <ListItem sx={{ pb: 0 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  History
                </Typography>
              </ListItem>
            </>
          )}

          {/* Standard Notifications */}
          {notifications.length === 0 && activeSummaries.length === 0 && (
            <ListItem>
              <ListItemText
                primary="No notifications"
                secondary="Summaries will appear here when ready."
              />
            </ListItem>
          )}
          {notifications.map((notif, index) => (
            <React.Fragment key={index}>
              <ListItem
                button
                onClick={() => onNotificationClick(notif)}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteCachedSummary(notif.filename);
                    }}
                    sx={{ color: "#ff1744" }} // bright red
                  >
                    <DeleteIcon />
                  </IconButton>
                }
                sx={{
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  transition: "background-color 0.2s",
                  backgroundColor: !notif.read
                    ? "rgba(144, 202, 249, 0.08)"
                    : "inherit",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                  },
                  paddingRight: "48px", // Make space for secondary action
                }}
              >
                <ArticleIcon sx={{ marginRight: 2, color: "primary.main" }} />
                <ListItemText
                  primary={notif.filename}
                  secondary={
                    notif.result ? "Summary Ready" : `Status: ${notif.status}`
                  }
                />
              </ListItem>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
      </Box>
    </Drawer>
  );
}

export default NotificationSidebar;
