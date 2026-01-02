import { render, screen, fireEvent } from '@testing-library/react';
import NavBar from './NavBar';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ currentUser: { email: 'test@test.com' }, logout: vi.fn() })
}));

vi.mock('../contexts/DocumentSetContext', () => ({
    useDocumentSet: () => ({ selectedSet: 'all', documentSets: [], setSelectedSet: vi.fn(), fetchDocumentSets: vi.fn() })
}));

const theme = createTheme();

// Wrapper to provide Theme context
const WrappedNavBar = (props) => (
    <ThemeProvider theme={theme}>
        <NavBar {...props} />
    </ThemeProvider>
);

describe('NavBar', () => {
    it('renders title', () => {
        render(<WrappedNavBar />);
        expect(screen.getByText('AI Doc Search')).toBeInTheDocument();
    });

    it('renders navigation buttons (desktop)', () => {
        // Assuming desktop view by default in jsdom (width not small)
        render(
            <WrappedNavBar
                onShowSearch={() => { }}
                onShowDocuments={() => { }}
                onShowSummarize={() => { }}
                onShowNotifications={() => { }}
            />
        );
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /summarize/i })).toBeInTheDocument();
    });

    it('calls onShowSearch when Search button clicked', () => {
        const onShowSearch = vi.fn();
        render(
            <WrappedNavBar
                onShowSearch={onShowSearch}
                onShowDocuments={() => { }}
                onShowSummarize={() => { }}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /search/i }));
        expect(onShowSearch).toHaveBeenCalled();
    });
});
