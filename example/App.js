import { useState, useEffect } from 'brahmos';

import { BrahmosLogo, GithubLogo } from './Logos';
import TodoList from './todo-list';
import ConcurrentModeDemo from './concurrent-mode';
import SuspenseListDemo from './suspense-list';
import UseDeferredValueDemo from './use-deferred-value';
import UseDeferredValueSuspenseDemo from './use-deferred-value-suspense';
import LazyComponentDemo from './lazy-component';
import PortalDemo from './portals';
import ErrorBoundariesDemo from './error-boundaries';
import SVGDemo from './svg-chart';
import HooksDemo from './hooks';
import ContextDemo from './context-api';
import RechartExample from './third-party-component';

import './App.scss';

const examples = [
  {
    title: 'TODO List',
    id: 'todo-list',
    Component: TodoList,
  },
  {
    title: 'Context API',
    id: 'context-api',
    Component: ContextDemo,
  },
  {
    title: 'Hooks Demo',
    id: 'hooks',
    Component: HooksDemo,
  },
  {
    title: 'Error Boundaries Demo',
    id: 'error-boundaries',
    Component: ErrorBoundariesDemo,
  },
  {
    title: 'SVG Support Demo',
    id: 'svg-support',
    Component: SVGDemo,
  },
  {
    title: 'Portal Demo',
    id: 'portals',
    Component: PortalDemo,
  },
  {
    title: 'Concurrent Mode Demo',
    id: 'concurrent-mode',
    Component: ConcurrentModeDemo,
  },
  {
    title: 'Suspense List Demo',
    id: 'suspense-list',
    Component: SuspenseListDemo,
  },
  {
    title: 'Suspense with useDeferredValue',
    id: 'use-deferred-value-suspense',
    Component: UseDeferredValueSuspenseDemo,
  },
  {
    title: 'Time slicing with useDeferredValue',
    id: 'use-deferred-value',
    Component: UseDeferredValueDemo,
  },
  {
    title: 'Lazy Component Demo',
    id: 'lazy-component',
    Component: LazyComponentDemo,
  },
  {
    title: 'Third Party React Component',
    id: 'third-party-component',
    Component: RechartExample,
  },
];

function getCurrentExample() {
  const currentHash = document.location.hash.replace(/^#/, '');
  const routeIndex = Math.max(
    examples.findIndex((route) => route.id === currentHash),
    0,
  );
  return examples[routeIndex];
}

export default function App() {
  const [currentExample, setCurrentExample] = useState(getCurrentExample);
  const { Component: CurrentComponent, title } = currentExample;

  useEffect(() => {
    window.addEventListener('popstate', () => {
      const newExample = getCurrentExample();
      setCurrentExample(newExample);
    });
  }, []);

  return (
    <div className="app-container">
      <header class="hero is-primary">
        <div class="hero-body">
          <a href="https://github.com/brahmosjs/brahmos" target="_blank" rel="noopener">
            <div className="logo">
              <BrahmosLogo class="brahmos-logo" />
              <GithubLogo class="github-logo" />
            </div>
          </a>

          <div>
            <h1 class="title">
              Brahmos Demo{' '}
              <iframe
                src="https://ghbtns.com/github-btn.html?user=brahmosjs&repo=brahmos&type=fork&count=false&size=large"
                frameborder="0"
                scrolling="0"
                width="170"
                height="30"
                className="star-btn"
                title="GitHub"
              ></iframe>
            </h1>
            <h2 class="subtitle">
              Brahmos is a Super charged UI library with exact same declarative APIs of React which
              uses native templates to separate static and dynamic parts of an application for
              faster updates.
            </h2>
          </div>
        </div>
      </header>
      <div className="body row">
        <aside className="menu has-background-light column is-one-quarter">
          <nav className="menu-list">
            <ul>
              {examples.map((example) => {
                const { title, id } = example;
                return (
                  <li className="menu-list-item">
                    <a href={`#${id}`} className={example === currentExample ? 'is-active' : ''}>
                      {title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>
        <div className="example-container content column">
          <h2>{title}</h2>
          <CurrentComponent />
        </div>
      </div>
    </div>
  );
}
