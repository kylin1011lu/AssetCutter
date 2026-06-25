import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import { ProjectFooter } from '../app/ProjectFooter';
import { translations } from '../i18n/translations';

describe('App footer', () => {
  afterEach(() => cleanup());

  test('shows English open-source information and repository link', () => {
    render(<ProjectFooter t={translations.en} />);

    const repositoryLink = screen.getByRole('link', { name: 'GitHub Repository' });
    expect(screen.getByTestId('project-footer')).toHaveTextContent('Open source under the MIT License.');
    expect(repositoryLink).toHaveAttribute('href', 'https://github.com/kylin1011lu/AssetCutter');
  });

  test('shows Chinese open-source information and repository link', () => {
    render(<ProjectFooter t={translations.zh} />);

    expect(screen.getByTestId('project-footer')).toHaveTextContent('基于 MIT License 开源。');
    expect(screen.getByRole('link', { name: 'GitHub 仓库' })).toHaveAttribute(
      'href',
      'https://github.com/kylin1011lu/AssetCutter',
    );
  });
});
