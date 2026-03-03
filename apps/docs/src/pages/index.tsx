import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

// Workaround: Docusaurus Link type is incompatible with React 18/19 mixed environment
const TypedLink = Link as React.ComponentType<{
  className?: string;
  to: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}>;

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <TypedLink
            className="button button--secondary button--lg"
            to="/user/intro">
            Get Started
          </TypedLink>
          <TypedLink
            className="button button--secondary button--lg"
            to="https://github.com/LinXueyuanStdio/viben/releases"
            style={{marginLeft: '1rem'}}>
            Download Desktop App
          </TypedLink>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} - Multi-Agent Workspace Manager`}
      description="Unified management for AI assistants, MCP servers, and development tasks across Claude Code, Cursor, Codex and more">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
