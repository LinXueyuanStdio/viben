import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Viben',
  tagline: 'Multi-Agent Workspace Manager for AI-Assisted Development',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Enable Docusaurus v4 future flags
  },

  // Set the production url of your site here
  url: 'https://linxueyuan.online',
  // Set the /<baseUrl>/ pathname under which your site is served
  // Landing page is at /viben/, docs are at /viben/docs/
  baseUrl: '/viben/',

  // GitHub pages deployment config.
  organizationName: 'LinXueyuanStdio', // GitHub org/user name
  projectName: 'viben', // Repo name
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  markdown: {
    mermaid: true,
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh-Hans'],
    localeConfigs: {
      en: {
        label: 'English',
        direction: 'ltr',
        htmlLang: 'en-US',
        calendar: 'gregory',
      },
      'zh-Hans': {
        label: '简体中文',
        direction: 'ltr',
        htmlLang: 'zh-CN',
        calendar: 'gregory',
        path: 'zh-Hans',
      },
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          // Main docs instance for user-facing documentation
          path: 'docs/user',
          routeBasePath: 'user',
          sidebarPath: './sidebars/user.ts',
          editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // CLI documentation
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'cli',
        path: 'docs/cli',
        routeBasePath: 'cli',
        sidebarPath: './sidebars/cli.ts',
        editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
      },
    ],
    // Frontend developer documentation
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'frontend',
        path: 'docs/frontend',
        routeBasePath: 'frontend',
        sidebarPath: './sidebars/frontend.ts',
        editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
      },
    ],
    // Backend developer documentation
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'backend',
        path: 'docs/backend',
        routeBasePath: 'backend',
        sidebarPath: './sidebars/backend.ts',
        editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
      },
    ],
    // Agent developer documentation
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'agent',
        path: 'docs/agent',
        routeBasePath: 'agent',
        sidebarPath: './sidebars/agent.ts',
        editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
      },
    ],
    // Shared documentation
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'shared',
        path: 'docs/shared',
        routeBasePath: 'shared',
        sidebarPath: './sidebars/shared.ts',
        editUrl: 'https://github.com/LinXueyuanStdio/viben/edit/main/apps/docs/',
      },
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/viben-social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    mermaid: {
      theme: {light: 'default', dark: 'dark'},
      options: {
        maxTextSize: 50000,
        securityLevel: 'loose',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis',
        },
        sequence: {
          diagramMarginX: 50,
          diagramMarginY: 10,
          useMaxWidth: true,
        },
      },
    },
    navbar: {
      title: 'Viben',
      logo: {
        alt: 'Viben Logo',
        src: 'img/logo.svg',
      },
      items: [
        // User docs (default)
        {
          type: 'docSidebar',
          sidebarId: 'userSidebar',
          position: 'left',
          label: 'User Guide',
        },
        // CLI docs
        {
          to: '/cli/',
          label: 'CLI',
          position: 'left',
          activeBaseRegex: `/cli/`,
        },
        // Developer docs dropdown
        {
          type: 'dropdown',
          label: 'Developer',
          position: 'left',
          items: [
            {
              to: '/frontend/',
              label: 'Frontend',
            },
            {
              to: '/backend/',
              label: 'Backend',
            },
            {
              to: '/agent/',
              label: 'Agent',
            },
            {
              to: '/shared/',
              label: 'Shared',
            },
          ],
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/LinXueyuanStdio/viben',
          label: 'GitHub',
          position: 'right',
          className: 'header-github-link',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'User',
          items: [
            {label: 'Getting Started', to: '/user/getting-started/installation'},
            {label: 'Desktop App', to: '/user/desktop/'},
            {label: 'MCP Server', to: '/user/mcp/configuration'},
          ],
        },
        {
          title: 'Developer',
          items: [
            {label: 'CLI', to: '/cli/'},
            {label: 'Frontend', to: '/frontend/'},
            {label: 'Backend', to: '/backend/'},
            {label: 'Agent', to: '/agent/'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub Issues', href: 'https://github.com/LinXueyuanStdio/viben/issues'},
            {label: 'GitHub Discussions', href: 'https://github.com/LinXueyuanStdio/viben/discussions'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'Blog', to: '/blog'},
            {label: 'GitHub', href: 'https://github.com/LinXueyuanStdio/viben'},
            {label: 'PyPI', href: 'https://pypi.org/project/browse-mcp/'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Viben Project. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'python', 'toml', 'yaml', 'rust', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
