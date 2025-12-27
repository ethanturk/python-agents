import React from 'react';
import { Drawer, Box, Typography, IconButton, List, ListItem, ListItemText, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArticleIcon from '@mui/icons-material/Article';

function NotificationSidebar({ open, onClose, notifications, onNotificationClick }) {
    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box className="notification-list" role="presentation">
                <Box className="notification-sidebar-header">
                    <Typography variant="h6">Notifications</Typography>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <List>
                    {notifications.length === 0 && (
                        <ListItem>
                            <ListItemText primary="No notifications" secondary="Summaries will appear here when ready." />
                        </ListItem>
                    )}
                    {notifications.map((notif, index) => (
                        <React.Fragment key={index}>
                            <ListItem
                                className={`notification-item ${!notif.read ? 'notification-unread' : ''}`}
                                onClick={() => onNotificationClick(notif)}
                            >
                                <ArticleIcon sx={{ marginRight: 2, color: 'primary.main' }} />
                                <ListItemText
                                    primary={notif.filename}
                                    secondary={notif.result ? "Summary Ready" : `Status: ${notif.status}`}
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
