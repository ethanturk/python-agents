import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DocumentListView from './DocumentListView';
import { describe, it, expect, vi } from 'vitest';

// Mock the context hook
vi.mock('../contexts/DocumentSetContext', () => ({
    useDocumentSet: () => ({
        selectedSet: 'all'
    })
}));

describe('DocumentListView', () => {
    const mockGroupedDocs = {
        '/path/to/test1.txt': [
            { id: '1', filename: '/path/to/test1.txt', content_snippet: 'snippet 1' }
        ],
        '/path/to/test2.pdf': [
            { id: '2', filename: '/path/to/test2.pdf', content_snippet: 'snippet 2' }
        ]
    };

    it('renders list of documents (filenames)', () => {
        render(<DocumentListView groupedDocs={mockGroupedDocs} onDelete={() => { }} onSummarize={() => { }} />);
        expect(screen.getByText('test1.txt')).toBeInTheDocument();
        expect(screen.getByText('test2.pdf')).toBeInTheDocument();
    });

    it('renders empty state correctly', () => {
        render(<DocumentListView groupedDocs={{}} onDelete={() => { }} onSummarize={() => { }} />);
        expect(screen.getByText(/No documents found/i)).toBeInTheDocument();
    });

    it('calls onSummarize when Summarize button clicked', async () => {
        const user = userEvent.setup();
        const onSummarize = vi.fn();
        render(<DocumentListView groupedDocs={mockGroupedDocs} onDelete={() => { }} onSummarize={onSummarize} />);

        // Find specific button by testid
        const summarizeBtn = screen.getByTestId('summarize-btn-/path/to/test1.txt');
        await user.click(summarizeBtn);

        expect(onSummarize).toHaveBeenCalledWith('/path/to/test1.txt');
    });

    it('calls onDelete when Delete button clicked', async () => {
        const user = userEvent.setup();
        const onDelete = vi.fn();
        render(<DocumentListView groupedDocs={mockGroupedDocs} onDelete={onDelete} onSummarize={() => { }} />);

        // Find specific delete button for test1
        const deleteBtn = screen.getByTestId('delete-btn-/path/to/test1.txt');
        fireEvent.click(deleteBtn);
        expect(onDelete).toHaveBeenCalledWith('/path/to/test1.txt');
    });
});
