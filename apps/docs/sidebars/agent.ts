import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  agentSidebar: [
    'index',
    'mcp-development',
    'skill-development',
    'cli-integration',
    {
      type: 'category',
      label: 'Templates',
      collapsed: false,
      items: [
        'templates/agent-templates',
      ],
    },
    'best-practices',
    {
      type: 'link',
      label: 'Shared Docs',
      href: '/shared/',
    },
  ],
};

export default sidebars;
