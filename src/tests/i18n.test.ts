import { describe, expect, test } from 'vitest';
import { getInitialLanguage, translations } from '../i18n/translations';

describe('getInitialLanguage', () => {
  test('prefers saved language when it is supported', () => {
    expect(getInitialLanguage('en', 'zh-CN')).toBe('en');
    expect(getInitialLanguage('zh', 'en-US')).toBe('zh');
  });

  test('falls back to browser language and then English', () => {
    expect(getInitialLanguage(null, 'zh-CN')).toBe('zh');
    expect(getInitialLanguage(null, 'en-US')).toBe('en');
    expect(getInitialLanguage(null, 'fr-FR')).toBe('en');
  });
});

describe('translations', () => {
  test('contains Chinese and English labels for core actions', () => {
    expect(translations.en.importImage).toBe('Import');
    expect(translations.zh.importImage).toBe('导入');
    expect(translations.en.removeBg).toBe('Remove BG');
    expect(translations.zh.removeBg).toBe('移除背景');
  });
});
