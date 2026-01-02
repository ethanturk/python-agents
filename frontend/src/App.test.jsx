import { render, screen } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./contexts/AuthContext', () => ({
    useAuth: () => ({ currentUser: { email: 'test@test.com' } })
}));

vi.mock('./contexts/DocumentSetContext', () => ({
    useDocumentSet: () => ({ selectedSet: 'all', documentSets: [] })
}));

vi.mock('./hooks/useWebSocket', () => ({
    default: () => ({ isConnected: true })
}));

vi.mock('./hooks/useDocuments', () => ({
    default: () => ({
        groupedDocs: {},
        loading: false,
        ensureDocsLoaded: vi.fn(), 
        fetchDocuments: vi.fn(),
        handlePromptDelete: vi.fn(), 
        confirmDelete: vi.fn()
    })
}));

vi.mock('./hooks/useSearch', () => ({
    default: () => ({
        query: '',
        searchData: { results: [] },
        handleSearch: vi.fn(),
        handleSendSearchChat: vi.fn()
    })
}));

vi.mock('./hooks/useSummarization', () => ({
    default: () => ({
        notifications: [],
        activeSummaries: [],
        handleBackendSummaries: vi.fn()
    })
}));

describe('App', () => {
    it('renders without crashing', () => {
        render(<App />);
        expect(screen.getByText('AI Doc Search')).toBeInTheDocument();
    });
});
