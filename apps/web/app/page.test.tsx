import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page from './page';

vi.mock('./components/community/community-home', () => ({
  CommunityHome: () => <main><h1>Discover published work</h1><a href="/landing">/landing</a></main>,
}));

describe('CommunityHomePage', () => {
  it('renders the community discovery homepage at root', async () => {
    render(await Page());

    expect(screen.getByRole('heading', { name: 'Discover published work' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '/landing' })).toHaveAttribute('href', '/landing');
  });
});
