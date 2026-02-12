import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  backendSidebar: [
    'index',
    'directory-structure',
    'database-guidelines',
    'error-handling',
    'logging-guidelines',
    'quality-guidelines',
    {
      type: 'category',
      label: 'Gateway',
      collapsed: false,
      items: [
        'gateway/index',
        'gateway/agents',
        'gateway/channels',
        'gateway/chat-list',
        'gateway/cron',
        'gateway/events',
        'gateway/executors',
        'gateway/group-chats',
        'gateway/health',
        'gateway/models',
        'gateway/providers',
        'gateway/sessions',
        'gateway/tasks',
        'gateway/websocket',
      ],
    },
    {
      type: 'category',
      label: 'API',
      collapsed: false,
      items: [
        'api/mcp-api',
        'api/skills-api',
        'api/user-api',
        'api/social-api',
        'api/collections-api',
        'api/packages',
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      collapsed: false,
      items: [
        'modules/auth',
        'modules/database',
        'modules/storage',
        'modules/project-setup',
      ],
    },
    {
      type: 'category',
      label: 'Deployment',
      collapsed: false,
      items: [
        'deployment/vercel',
        'deployment/github-oauth',
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
