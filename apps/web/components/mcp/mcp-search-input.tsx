'use client';

import { useTranslation } from 'react-i18next';
import { SearchInput } from '@/components/shared/search-input';
import type { McpSource } from './source-tabs';

interface McpSearchInputProps {
  source: McpSource;
  defaultValue?: string;
}

export function McpSearchInput({ source, defaultValue }: McpSearchInputProps) {
  const { t } = useTranslation();

  return (
    <SearchInput
      placeholder={
        source === 'official'
          ? t('marketplace.searchOfficialPlaceholder')
          : t('marketplace.searchPlaceholder')
      }
      defaultValue={defaultValue}
    />
  );
}
