'use client';

import { useCallback, useEffect, useState } from 'react';
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
  setLanguage,
  getCurrentLanguage,
} from '@/lib/i18n';

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = useState(DEFAULT_LANGUAGE);
  const [mounted, setMounted] = useState(false);

  // Only access localStorage after mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setCurrentLang(getCurrentLanguage());

    // Listen for language changes from other components
    const handleLanguageChange = (event: CustomEvent<{ language: string }>) => {
      setCurrentLang(event.detail.language);
    };

    window.addEventListener(
      'languagechange',
      handleLanguageChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'languagechange',
        handleLanguageChange as EventListener
      );
    };
  }, []);

  const handleLanguageSelect = useCallback((langCode: string) => {
    setLanguage(langCode);
    setCurrentLang(langCode);
  }, []);

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
