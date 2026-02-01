import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Browse MCP',
  tagline: 'Search, Download, and Read Academic Papers with MCP',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Enable Docusaurus v4 future flags
  },

  // Set the production url of your site here
  url: 'https://linxueyuan.online',
  // Set the /<baseUrl>/ pathname under which your site is served
  // Landing page is at /browse-mcp/, docs are at /browse-mcp/docs/
  baseUrl: '/browse-mcp/docs/',

  // GitHub pages deployment config.
  organizationName: 'LinXueyuanStdio', // GitHub org/user name
  projectName: 'browse-mcp', // Repo name
  trailingSlash: false,

  onBrokenLinks: 'throw',

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
          sidebarPath: './sidebars.ts',
          // Build correct edit URLs for files under repo/apps/docs/docs
          editUrl: 'https://github.com/LinXueyuanStdio/browse-mcp/edit/main/apps/docs/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Build correct edit URLs for files under repo/apps/docs/blog
          editUrl: 'https://github.com/LinXueyuanStdio/browse-mcp/edit/main/apps/docs/',
          // Useful options to enforce blogging best practices
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

  themes: ['@docusaurus/theme-mermaid'],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/browse-mcp-social-card.png',
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
      title: 'Browse MCP',
      logo: {
        alt: 'Browse MCP Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/LinXueyuanStdio/browse-mcp',
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
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: '/docs/intro'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub Issues', href: 'https://github.com/LinXueyuanStdio/browse-mcp/issues'},
            {label: 'GitHub Discussions', href: 'https://github.com/LinXueyuanStdio/browse-mcp/discussions'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'Blog', to: '/blog'},
            {label: 'GitHub', href: 'https://github.com/LinXueyuanStdio/browse-mcp'},
            {label: 'PyPI', href: 'https://pypi.org/project/browse-mcp/'},
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Browse MCP Project. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'python', 'toml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
