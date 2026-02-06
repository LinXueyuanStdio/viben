import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  tutorialSidebar: [
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
        'desktop-app/index',
        'desktop-app/installation',
        'desktop-app/features',
      ],
    },
    {
      type: 'category',
      label: 'CLI',
      collapsed: false,
      items: [
        'cli/index',
        'cli/installation',
        'cli/quick-start',
      ],
    },
    {
      type: 'category',
      label: 'MCP Server',
      collapsed: false,
      items: [
        'mcp-server/configuration',
        {
          type: 'category',
          label: 'Tools',
          collapsed: false,
          items: [
            'mcp-server/tools/browse-search',
            'mcp-server/tools/browse-download',
            'mcp-server/tools/browse-read',
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
    {
      type: 'category',
      label: 'CLI',
      collapsed: false,
      items: [
        {
          type: 'category',
          label: 'Configuration',
          collapsed: false,
          items: [
            'cli/configuration/index',
            'cli/configuration/config-command',
            'cli/configuration/providers',
            'cli/configuration/models',
          ],
        },
      ],
    },
  ],
};

export default sidebars;
