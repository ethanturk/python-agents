import { AppBar, Toolbar, Typography, Button } from '@mui/material';

export default function NavBar({ onShowSearch, onShowDocuments, onShowSummarize }) {
    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" component="div" className="flex-grow-1">
                    Agent Document Manager
                </Typography>
                <Button color="inherit" onClick={onShowSearch}>Search</Button>
                <Button color="inherit" onClick={onShowDocuments}>Documents</Button>
                <Button color="inherit" onClick={onShowSummarize}>Summarize</Button>
            </Toolbar>
        </AppBar>
    );
}
