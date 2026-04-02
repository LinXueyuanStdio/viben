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
    title: 'FileEvo - Code Iterative Optimization',
    Svg: require('@site/static/img/workspace-management.svg').default,
    description: (
      <>
        Multi-candidate sampling + quality evaluation algorithm that automatically
        selects and merges the best solution. Heuristic iterative optimization
        through sampling-evaluation-selection loops.
      </>
    ),
  },
  {
    title: 'Multi-Agent Orchestration',
    Svg: require('@site/static/img/agent-orchestration.svg').default,
    description: (
      <>
        Agent swarm orchestration with parallel worktree isolation. Automated task
        distribution and real-time monitoring across multiple AI agents working
        together.
      </>
    ),
  },
  {
    title: 'XState Task System',
    Svg: require('@site/static/img/kanban-board.svg').default,
    description: (
      <>
        State machine-driven task lifecycle management with kanban board, queue,
        and auto-execution. Complete workflow from backlog to completed with
        plan → implement → check → fix loops.
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
