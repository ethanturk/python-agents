import React, { useState, useEffect } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import Badge from '@mui/material/Badge';
import { Box, CircularProgress, Menu, MenuItem, useTheme, useMediaQuery, Select, FormControl, InputLabel } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Notifications, Logout } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentSet } from '../contexts/DocumentSetContext';
import { formatDocumentSetName } from '../utils';

function NavBar({ onShowSearch, onShowDocuments, onShowSummarize, onShowNotifications, unreadCount, loading, showSuccess }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [anchorEl, setAnchorEl] = useState(null);
    const { logout, currentUser } = useAuth();
    const { documentSets, selectedSet, setSelectedSet, fetchDocumentSets } = useDocumentSet();

    useEffect(() => {
        if (currentUser) {
            fetchDocumentSets();
        }
    }, [currentUser]);

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleMenuClick = (action) => {
        action();
        handleClose();
    };

    return (
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Toolbar>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                    AI Doc Search
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {/* Document Set Selector */}
                    <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
                        <InputLabel id="doc-set-select-label">Doc Set</InputLabel>
                        <Select
                            labelId="doc-set-select-label"
                            id="doc-set-select"
                            value={selectedSet}
                            label="Doc Set"
                            onChange={(e) => setSelectedSet(e.target.value)}
                        >
                            <MenuItem value="all">All</MenuItem>
                            {documentSets.map((ds) => (
                                <MenuItem key={ds} value={ds}>{formatDocumentSetName(ds)}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Status Indicators remain visible */}
                    {loading && <CircularProgress size={24} color="inherit" />}
                    {!loading && showSuccess && <CheckCircleIcon color="success" />}

                    {isMobile ? (
                        <>
                            <IconButton
                                size="large"
                                edge="start"
                                color="inherit"
                                aria-label="menu"
                                onClick={handleMenu}
                            >
                                <MenuIcon />
                            </IconButton>
                            <Menu
                                id="menu-appbar"
                                anchorEl={anchorEl}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                keepMounted
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                open={Boolean(anchorEl)}
                                onClose={handleClose}
                            >
                                <MenuItem onClick={() => handleMenuClick(onShowSearch)}>Search</MenuItem>
                                <MenuItem onClick={() => handleMenuClick(onShowDocuments)}>Documents</MenuItem>
                                <MenuItem onClick={() => handleMenuClick(onShowSummarize)}>Summarize</MenuItem>
                                <MenuItem onClick={() => handleMenuClick(onShowNotifications)}>
                                    Notifications
                                    {unreadCount > 0 && ` (${unreadCount})`}
                                </MenuItem>
                                <MenuItem onClick={logout}>Logout</MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <Box className="nav-buttons" sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Button color="inherit" onClick={onShowSearch}>Search</Button>
                            <Button color="inherit" onClick={onShowDocuments}>Documents</Button>
                            <Button color="inherit" onClick={onShowSummarize}>Summarize</Button>
                            <IconButton color="inherit" onClick={onShowNotifications}>
                                <Badge badgeContent={unreadCount} color="error">
                                    {loading ? <CircularProgress size={24} color="inherit" /> : (showSuccess ? <CheckCircleIcon color="success" /> : <Notifications />)}
                                </Badge>
                            </IconButton>

                            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" sx={{ opacity: 0.7 }}>{currentUser?.email}</Typography>
                                <IconButton color="inherit" onClick={logout} title="Logout">
                                    <Logout />
                                </IconButton>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Toolbar>
        </AppBar>
    );
}

export default NavBar;
