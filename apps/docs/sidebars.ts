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
      label: 'MCP Server',
      collapsed: false,
      items: [
        'mcp-server/configuration',
        {
          type: 'category',
          label: 'Tools',
          collapsed: false,
          items: [
            'mcp-server/tools/paper-search',
            'mcp-server/tools/paper-download',
            'mcp-server/tools/paper-read',
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
