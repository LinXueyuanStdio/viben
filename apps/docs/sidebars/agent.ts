import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  agentSidebar: [
    'index',
    'mcp-development',
    'skill-development',
    'cli-integration',
    'templates/agent-templates',
    'best-practices',
    {
      type: 'link',
      label: 'Shared Docs',
      href: '/shared/',
    },
  ],
};

export default sidebars;
