# Add i18next Internationalization Support for Desktop App

## Goal

Implement comprehensive internationalization (i18n) support for the Browse MCP desktop application, enabling users worldwide to use the app in their native language. Support 20+ languages with automatic language detection and a user-friendly language switcher.

---

## Requirements

### 1. Core Implementation

- **Library**: Use i18next + react-i18next for translation management
- **Languages**: Support 20+ LTR (left-to-right) languages:
  - Primary: English (en), Simplified Chinese (zh-CN), Japanese (ja)
  - Additional: German (de), French (fr), Spanish (es), Portuguese (pt), Italian (it), Dutch (nl), Polish (pl), Russian (ru), Turkish (tr), Korean (ko), Vietnamese (vi), Thai (th), Indonesian (id), Malay (ms), Hindi (hi), Ukrainian (uk), Swedish (sv), Norwegian (no)
- **No RTL Support**: Exclude RTL languages (Arabic, Hebrew) in this phase
- **Auto-detection**: Automatically detect and apply user's system language on first launch
- **Fallback**: Use English if detected language is not supported

### 2. Language Detection Order

```
1. User preference (from app store / localStorage)
2. Tauri system locale API (@tauri-apps/api)
3. Browser navigator.language
4. Fallback to English (en)
```

### 3. Translation Coverage

**Complete UI Text Replacement** - Extract and translate ALL hardcoded text strings from:

- **Pages**:
  - `dashboard.tsx` - Dashboard metrics, status messages
  - `settings.tsx` - Settings labels, descriptions
  - `about.tsx` - Version info, credits
  - `providers.tsx` - Provider status, descriptions
  - `agents.tsx` - Agent configuration messages
  - `logs.tsx` - Log viewer labels
  - `search-service.tsx` - Service configuration labels

- **Components**:
  - `sidebar.tsx` - Navigation items

- **Other UI Elements**:
  - Button labels
  - Form labels and placeholders
  - Error messages
  - Toast notifications (if any)
  - Confirmation dialogs

### 4. Language Switcher UI

- **Location**: Settings page (apps/desktop/src/pages/settings.tsx)
- **Design**: Dropdown/select component with all 20+ language options
- **Connection**: Wire to existing Zustand store `language` state
- **Display**: Show both native language name and English name (e.g., "中文 (Chinese)")

### 5. State Management Integration

**Existing Store** (`apps/desktop/src/stores/app-store.ts`):
```typescript
// Current (needs expansion):
language: "en" | "zh";
setLanguage: (lang: "en" | "zh") => void;

// New (support all 20+ languages):
language: string; // Language code (e.g., "en", "zh-CN", "ja")
setLanguage: (lang: string) => void;
```

**Persistence**: Already uses Zustand `persist` middleware → saves to localStorage automatically

### 6. Translation Content Generation

- **Method**: AI-generated translations (Claude/GPT)
- **Quality**: Human review recommended for primary languages (en, zh-CN, ja)
- **Format**: JSON files in `apps/desktop/src/i18n/locales/`
- **Namespace**: Single namespace "translation" (can split later if needed)

---

## Technical Architecture

### File Structure

```
apps/desktop/src/
├── i18n/
│   ├── index.ts                      # i18next config & initialization
│   ├── languages.ts                  # Language list with metadata
│   └── locales/
│       ├── en.json                   # English (baseline)
│       ├── zh-CN.json                # Simplified Chinese
│       ├── ja.json                   # Japanese
│       ├── de.json                   # German
│       ├── fr.json                   # French
│       └── ... (17 more languages)
├── main.tsx                          # Initialize i18next before render
├── App.tsx                           # (may need I18nextProvider wrapper)
├── types/
│   └── index.ts                      # Add i18n type definitions
├── stores/
│   └── app-store.ts                  # Expand language type
└── pages/
    └── settings.tsx                  # Add language switcher UI
```

### Dependencies

```json
{
  "dependencies": {
    "i18next": "^24.0.0",
    "react-i18next": "^15.0.0",
    "i18next-browser-languagedetector": "^8.0.0"
  },
  "devDependencies": {
    "@types/i18next": "^13.0.0"
  }
}
```

### i18next Configuration (apps/desktop/src/i18n/index.ts)

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all locale files
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';
import ja from './locales/ja.json';
// ... import other languages

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  ja: { translation: ja },
  // ... add other languages
};

i18n
  .use(LanguageDetector) // Auto-detect user language
  .use(initReactI18next)  // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
```

### Usage Pattern

```tsx
// In components:
import { useTranslation } from 'react-i18next';

function Dashboard() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>
      <p>{t('dashboard.description')}</p>
    </div>
  );
}
```

---

## Acceptance Criteria

### Phase 1: Infrastructure Setup

- [ ] i18next + react-i18next installed and configured
- [ ] Auto language detection working (system locale → app language)
- [ ] 20+ language locale files created (even if translations incomplete)
- [ ] Language switcher UI added to settings page
- [ ] Language switcher connected to Zustand store
- [ ] Selected language persists across app restarts

### Phase 2: Translation Extraction & Generation

- [ ] All hardcoded text extracted from all pages and components
- [ ] Translation keys organized in logical namespaces (e.g., `dashboard.*`, `settings.*`)
- [ ] English baseline translations complete (en.json)
- [ ] AI-generated translations for all 20+ languages
- [ ] Primary languages (zh-CN, ja) reviewed for quality

### Phase 3: Integration & Testing

- [ ] All components use `useTranslation()` hook instead of hardcoded strings
- [ ] Language switcher displays all 20 languages with native names
- [ ] Switching language updates UI immediately (no reload required)
- [ ] Typography renders correctly for all languages (Crimson Pro + Inter fonts)
- [ ] No layout breaking when switching between languages
- [ ] TypeScript type safety for translation keys (optional but recommended)

### Quality Checks

- [ ] Lint passes (`pnpm lint`)
- [ ] Type check passes (`pnpm type-check`)
- [ ] App starts without errors
- [ ] All UI text is translatable (no hardcoded strings remain)
- [ ] Manual testing: Switch between 3-5 languages and verify UI correctness

---

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd apps/desktop
pnpm add i18next react-i18next i18next-browser-languagedetector
pnpm add -D @types/i18next
```

### Step 2: Create i18n Infrastructure

1. Create `apps/desktop/src/i18n/` directory
2. Create `languages.ts` with language metadata:
   ```typescript
   export const LANGUAGES = [
     { code: 'en', name: 'English', nativeName: 'English' },
     { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
     { code: 'ja', name: 'Japanese', nativeName: '日本語' },
     // ... 17 more
   ];
   ```
3. Create `index.ts` with i18next config (see above)
4. Create `locales/` directory with 20+ JSON files

### Step 3: Extract & Translate

1. Scan all pages/components for hardcoded text
2. Create English baseline (`locales/en.json`) with all keys
3. Generate translations for other 19 languages using AI
4. Review primary languages (zh-CN, ja) for accuracy

### Step 4: Integrate into App

1. Update `main.tsx` to initialize i18n before rendering
2. Update `App.tsx` (wrap with I18nextProvider if needed)
3. Replace all hardcoded text with `t('key')` calls
4. Update store type definitions

### Step 5: Add Language Switcher

1. Expand `app-store.ts` language type to `string`
2. Update settings page with dropdown/select
3. Wire to store's `setLanguage()` function
4. Add all 20 languages to dropdown

### Step 6: Test & Polish

1. Test language switching
2. Test auto-detection on first launch
3. Verify typography for all languages
4. Check persistence across restarts
5. Fix any layout issues

---

## Technical Constraints

### Typography Compatibility

Per design system:
- **Headings**: Crimson Pro (serif) - Verify CJK (Chinese/Japanese/Korean) character support
- **Body**: Inter (sans-serif) - Good Unicode coverage

If Crimson Pro doesn't support CJK, consider:
- Using system fallback fonts for CJK languages
- Or using Inter for all text in CJK languages

### Performance

- **Lazy Loading**: Consider lazy-loading language files if bundle size becomes large
- **Code Splitting**: i18next supports async loading with `i18next-http-backend` (future optimization)

### Tauri Integration

- For system locale detection, may need to use `@tauri-apps/api`:
  ```typescript
  import { locale } from '@tauri-apps/api/os';
  const systemLocale = await locale();
  ```

---

## Language List (20 Languages)

| Code | Language | Native Name |
|------|----------|-------------|
| en | English | English |
| zh-CN | Chinese (Simplified) | 简体中文 |
| ja | Japanese | 日本語 |
| de | German | Deutsch |
| fr | French | Français |
| es | Spanish | Español |
| pt | Portuguese | Português |
| it | Italian | Italiano |
| nl | Dutch | Nederlands |
| pl | Polish | Polski |
| ru | Russian | Русский |
| tr | Turkish | Türkçe |
| ko | Korean | 한국어 |
| vi | Vietnamese | Tiếng Việt |
| th | Thai | ไทย |
| id | Indonesian | Bahasa Indonesia |
| ms | Malay | Bahasa Melayu |
| hi | Hindi | हिन्दी |
| uk | Ukrainian | Українська |
| sv | Swedish | Svenska |

---

## Future Enhancements (Out of Scope)

- RTL language support (Arabic, Hebrew)
- Translation management system (e.g., Crowdin, Lokalise)
- Pluralization rules for complex languages
- Date/number formatting per locale
- Currency formatting
- User-contributed translations

---

## References

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)
- [Tauri Locale API](https://tauri.app/v1/api/js/os#locale)
- Research Report: See Research Agent analysis above

---

## Notes

- This is a frontend-only task (desktop app UI)
- Backend/MCP server internationalization is out of scope
- Documentation website i18n is separate (uses Docusaurus i18n)
- Existing `language` state in app-store.ts is a good foundation to build upon
