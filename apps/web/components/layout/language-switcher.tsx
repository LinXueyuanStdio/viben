'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  getLanguageByCode,
  changeLanguage,
} from '@/lib/i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Only access localStorage after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLanguageSelect = useCallback(
    (langCode: string) => {
      changeLanguage(langCode);
    },
    []
  );

  const currentLang = i18n.language || DEFAULT_LANGUAGE;
  const currentLanguage = getLanguageByCode(currentLang);

  // Prevent hydration mismatch by showing a placeholder during SSR
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Globe className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Select language</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={currentLanguage?.name}>
          <Globe className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">
            Select language (current: {currentLanguage?.nativeName})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <ScrollArea className="h-80">
          {LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              className={
                lang.code === currentLang
                  ? 'bg-accent text-accent-foreground'
                  : ''
              }
            >
              <span className="flex-1">{lang.nativeName}</span>
              <span className="text-xs text-muted-foreground">{lang.code}</span>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
