import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  frontendSidebar: [
    'index',
    'design-system',
    'components',
    'chat-integration',
    'chat-input-components',
    'tailwind-v4-setup',
    'marketplace-publish-flow',
    {
      type: 'category',
      label: 'Kanban',
      collapsed: false,
      items: [
        'kanban/integration',
        'kanban/features',
        'kanban/phase3-advanced',
        'kanban/phase4-collaboration',
        'kanban/phase5-automation',
        'kanban/phase6-views',
        'kanban/phase7-ai',
        'kanban/phase8-customization',
      ],
    },
    {
      type: 'category',
      label: 'Social Chat',
      collapsed: false,
      items: [
        'social-chat/index',
        'social-chat/chat-spec',
        'social-chat/contacts-spec',
        'social-chat/chat-prd',
      ],
    },
    {
      type: 'category',
      label: 'UI Modules',
      collapsed: false,
      items: [
        'modules/ui-shell',
        'modules/auth-ui',
        'modules/profile-ui',
        'modules/admin-ui',
      ],
    },
    {
      type: 'link',
      label: 'Shared Docs',
      href: '/shared/',
    },
  ],
};

export default sidebars;
