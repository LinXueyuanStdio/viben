import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  userSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/client-configuration',
      ],
    },
    {
      type: 'category',
      label: 'Desktop App',
      collapsed: false,
      items: [
        'desktop/index',
        'desktop/installation',
        'desktop/features',
      ],
    },
    {
      type: 'category',
      label: 'MCP Server',
      collapsed: false,
      items: [
        'mcp/configuration',
        {
          type: 'category',
          label: 'Tools',
          collapsed: false,
          items: [
            'mcp/tools/browse-search',
            'mcp/tools/browse-download',
            'mcp/tools/browse-read',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Plugins',
      collapsed: false,
      items: [
        'plugins/overview',
        'plugins/installing-plugins',
        'plugins/available-plugins',
        'plugins/social-media-plugin',
        'plugins/configuration',
      ],
    },
  ],
};

export default sidebars;
