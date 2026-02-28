import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: 'Multi-Workspace Management',
    Svg: require('@site/static/img/undraw_search.svg').default,
    description: (
      <>
        Manage multiple project workspaces with independent MCP servers,
        agent configurations (Claude Code, Cursor, Codex), Skills, and task boards.
      </>
    ),
  },
  {
    title: 'Agent Orchestration',
    Svg: require('@site/static/img/undraw_connected.svg').default,
    description: (
      <>
        Unified configuration management for Claude Code, Cursor, Codex and other
        AI programming assistants. One place for all your AI tools.
      </>
    ),
  },
  {
    title: 'Task & Kanban System',
    Svg: require('@site/static/img/undraw_easy.svg').default,
    description: (
      <>
        Built-in kanban board with task cards, priorities, tags, subtasks,
        dependencies, and activity tracking for your development workflow.
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
