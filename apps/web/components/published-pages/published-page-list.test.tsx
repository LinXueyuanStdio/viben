import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublishedPageList } from './published-page-list';

describe('PublishedPageList', () => {
  it('renders page cards with preview frames linked to the community read route', () => {
    render(
      <PublishedPageList
        userSlug="alice"
        pages={[
          {
            uid: 'demo',
            title: 'Demo',
            description: 'Demo description',
            html: '<!doctype html><html><body><h1>Demo HTML</h1></body></html>',
          },
          {
            uid: 'notes',
            title: 'Notes',
            description: null,
            html: '<!doctype html><html><body><p>Notes</p></body></html>',
          },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Published pages' })).toBeInTheDocument();

    const demoLink = screen.getByRole('link', { name: /Demo Demo description/i });
    expect(demoLink).toHaveAttribute('href', '/read/alice/demo');
    expect(screen.getByTitle('Preview: Demo')).toHaveAttribute(
      'srcDoc',
      '<!doctype html><html><body><h1>Demo HTML</h1></body></html>'
    );

    const notesLink = screen.getByRole('link', { name: /Notes/i });
    expect(notesLink).toHaveAttribute('href', '/read/alice/notes');
    expect(screen.getByTitle('Preview: Notes')).toBeInTheDocument();
  });

  it('renders an empty state for users without published pages', () => {
    render(<PublishedPageList userSlug="alice" pages={[]} />);

    expect(screen.getByText('No published pages yet.')).toBeInTheDocument();
  });
});
