import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders optimized lifecycle and faq sections', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: '完整生命周期，你始终在控制中' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '常见问题' })).toBeTruthy();
    expect(screen.getByRole('link', { name: '进入 MCP 市场' }).getAttribute('href')).toBe('/mcp');
  });
});
