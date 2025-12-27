import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Badge from '@mui/material/Badge';
import { Box } from '@mui/material';

function NavBar({ onShowSearch, onShowDocuments, onShowSummarize, onShowNotifications, unreadCount }) {
    return (
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                    Agent Workspace
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button color="inherit" onClick={onShowSearch}>Search</Button>
                    <Button color="inherit" onClick={onShowDocuments}>Documents</Button>
                    <Button color="inherit" onClick={onShowSummarize}>Summarize</Button>
                    <IconButton color="inherit" onClick={onShowNotifications}>
                        <Badge badgeContent={unreadCount} color="error">
                            <NotificationsIcon />
                        </Badge>
                    </IconButton>
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default NavBar;
