import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  sharedSidebar: [
    'index',
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/viben-core',
        'architecture/desktop-integration',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      collapsed: false,
      items: [
        'guides/index',
        'guides/cross-layer-thinking',
        'guides/code-reuse-thinking',
        'guides/design',
      ],
    },
    {
      type: 'category',
      label: 'Data Models',
      collapsed: false,
      items: [
        'data-models/workspace',
        'data-models/social-chat',
      ],
    },
    'provider-system',
    'plugin-architecture',
  ],
};

export default sidebars;
