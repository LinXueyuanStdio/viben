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
    title: 'Multi-Source Search',
    Svg: require('@site/static/img/undraw_search.svg').default,
    description: (
      <>
        Search academic papers from 19+ sources including arXiv, PubMed,
        Semantic Scholar, IEEE Xplore, and more through a unified interface.
      </>
    ),
  },
  {
    title: 'MCP Integration',
    Svg: require('@site/static/img/undraw_connected.svg').default,
    description: (
      <>
        Built on the Model Context Protocol (MCP) for seamless integration
        with Claude Desktop, Claude Code, and other MCP-compatible clients.
      </>
    ),
  },
  {
    title: 'Easy to Use',
    Svg: require('@site/static/img/undraw_easy.svg').default,
    description: (
      <>
        Simple installation via pip. Configure once, search everywhere.
        Three tools: browse_search, browse_download, and browse_read.
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
