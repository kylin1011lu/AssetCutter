import type { Translation } from '../i18n/translations';

export const repositoryUrl = 'https://github.com/kylin1011lu/AssetCutter';

export function ProjectFooter({ t }: { t: Translation }) {
  return (
    <footer className="projectFooter" data-testid="project-footer">
      <span>{t.openSourceNotice}</span>
      <a href={repositoryUrl} target="_blank" rel="noreferrer">
        {t.repositoryLink}
      </a>
    </footer>
  );
}
