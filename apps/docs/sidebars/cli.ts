import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  cliSidebar: [
    'index',
    'installation',
    'quick-start',
    {
      type: 'category',
      label: 'Configuration',
      collapsed: false,
      items: [
        'configuration/index',
        'configuration/config-command',
        'configuration/providers',
        'configuration/models',
      ],
    },
    {
      type: 'category',
      label: 'Agent Management',
      collapsed: false,
      items: [
        'agents/index',
        'agents/creating-agents',
        'agents/agent-configuration',
        'agents/memory-system',
        'agents/sessions',
        'agents/templates',
      ],
    },
    {
      type: 'category',
      label: 'Providers & Models',
      collapsed: false,
      items: [
        'providers-models/providers',
        'providers-models/models',
        'providers-models/aliases',
        'providers-models/fallbacks',
      ],
    },
    {
      type: 'category',
      label: 'Commands',
      collapsed: false,
      items: [
        'commands/index',
        'commands/init',
        'commands/config',
        'commands/service',
        'commands/gateway',
        'commands/mcp',
        'commands/skill',
        'commands/workspace',
        'commands/agent',
        'commands/agent-chat',
        'commands/provider',
        'commands/model',
        'commands/channel',
        'commands/cron',
        'commands/executor',
        'commands/executor-chat',
        'commands/team',
      ],
    },
  ],
};

export default sidebars;
