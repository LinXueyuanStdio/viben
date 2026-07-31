'use client';

import { useEffect } from 'react';

const SCALAR_CONFIG = {
  spec: {
    url: '/openapi.json',
  },
  servers: [
    { url: 'https://viben-web.vercel.app', description: '生产环境' },
    { url: 'http://localhost:3000', description: '本地开发' },
  ],
  authentication: {
    preferredSecurityScheme: 'session',
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description: '登录后自动设置的 session cookie',
      },
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT / API Key',
        description: 'API Key（bmcp_ 前缀）或 JWE session token',
      },
    },
  },
  theme: 'purple',
  layout: 'modern',
  darkMode: false,
  hideDownloadButton: true,
  hideClientButton: true,
  showSidebar: true,
  hideModels: false,
  hideTestRequestButton: false,
  metaData: {
    title: 'Viben API 文档',
    description: '面向 C 端创作者的 Viben 平台 API',
  },
  defaultOpenAllTags: false,
  searchHotKey: 'k',
};

export default function ApiDocsPage() {
  useEffect(() => {
    const config = document.createElement('script');
    config.id = 'api-reference';
    config.setAttribute('data-url', '/openapi.json');
    config.setAttribute(
      'data-configuration',
      JSON.stringify(SCALAR_CONFIG),
    );
    document.body.appendChild(config);

    const loader = document.createElement('script');
    loader.src = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference';
    document.body.appendChild(loader);
  }, []);

  return null;
}
