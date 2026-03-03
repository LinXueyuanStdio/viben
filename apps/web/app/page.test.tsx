import { render, screen } from '@testing-library/react';
import HomePage from './page';

describe('HomePage', () => {
  it('renders optimized lifecycle and faq sections', () => {
    render(<HomePage />);

    expect(screen.getByRole('tab', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tests' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '完整生命周期，你始终在控制中' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '常见问题' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '进入 MCP 市场' })).toHaveAttribute('href', '/mcp');
  });
});
