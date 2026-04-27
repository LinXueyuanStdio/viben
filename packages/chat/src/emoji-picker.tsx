/**
 * Emoji Picker Component
 *
 * A simple emoji grid organized by category.
 * Click an emoji to insert it at the cursor position.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn, Button } from "@viben/ui";

// Common emojis organized by category
const EMOJI_CATEGORIES = {
  smileys: {
    label: "Smileys",
    emojis: [
      "\u{1F600}",
      "\u{1F603}",
      "\u{1F604}",
      "\u{1F601}",
      "\u{1F606}",
      "\u{1F605}",
      "\u{1F602}",
      "\u{1F923}",
      "\u{1F60A}",
      "\u{1F607}",
      "\u{1F642}",
      "\u{1F643}",
      "\u{1F609}",
      "\u{1F60C}",
      "\u{1F60D}",
      "\u{1F970}",
      "\u{1F618}",
      "\u{1F617}",
      "\u{1F619}",
      "\u{1F61A}",
      "\u{1F60B}",
      "\u{1F61B}",
      "\u{1F61C}",
      "\u{1F92A}",
      "\u{1F61D}",
      "\u{1F911}",
      "\u{1F917}",
      "\u{1F92D}",
      "\u{1F92B}",
      "\u{1F914}",
    ],
  },
  gestures: {
    label: "Gestures",
    emojis: [
      "\u{1F44D}",
      "\u{1F44E}",
      "\u{1F44F}",
      "\u{1F64C}",
      "\u{1F91D}",
      "\u{1F64F}",
      "\u{270D}\u{FE0F}",
      "\u{1F4AA}",
      "\u{1F91E}",
      "\u{270C}\u{FE0F}",
      "\u{1F918}",
      "\u{1F44C}",
      "\u{1F448}",
      "\u{1F449}",
      "\u{1F446}",
      "\u{1F447}",
      "\u{261D}\u{FE0F}",
      "\u{1F590}\u{FE0F}",
      "\u{1F4AA}",
      "\u{1F44A}",
    ],
  },
  objects: {
    label: "Objects",
    emojis: [
      "\u{2764}\u{FE0F}",
      "\u{1F525}",
      "\u{2B50}",
      "\u{1F31F}",
      "\u{2728}",
      "\u{1F4A1}",
      "\u{1F389}",
      "\u{1F388}",
      "\u{1F381}",
      "\u{1F3C6}",
      "\u{1F4BB}",
      "\u{1F4F1}",
      "\u{1F4E7}",
      "\u{1F4DD}",
      "\u{1F4DA}",
      "\u{1F4D6}",
      "\u{1F50D}",
      "\u{1F511}",
      "\u{1F512}",
      "\u{1F513}",
    ],
  },
  nature: {
    label: "Nature",
    emojis: [
      "\u{2600}\u{FE0F}",
      "\u{1F324}\u{FE0F}",
      "\u{26C5}",
      "\u{1F327}\u{FE0F}",
      "\u{26A1}",
      "\u{2744}\u{FE0F}",
      "\u{1F308}",
      "\u{1F33B}",
      "\u{1F337}",
      "\u{1F339}",
      "\u{1F332}",
      "\u{1F334}",
      "\u{1F335}",
      "\u{1F340}",
      "\u{1F341}",
      "\u{1F343}",
      "\u{1F436}",
      "\u{1F431}",
      "\u{1F98A}",
      "\u{1F981}",
    ],
  },
  food: {
    label: "Food",
    emojis: [
      "\u{2615}",
      "\u{1F375}",
      "\u{1F377}",
      "\u{1F378}",
      "\u{1F37A}",
      "\u{1F354}",
      "\u{1F355}",
      "\u{1F35C}",
      "\u{1F363}",
      "\u{1F370}",
      "\u{1F366}",
      "\u{1F36B}",
      "\u{1F34E}",
      "\u{1F34A}",
      "\u{1F34B}",
      "\u{1F347}",
      "\u{1F353}",
      "\u{1F349}",
      "\u{1F34C}",
      "\u{1F952}",
    ],
  },
  symbols: {
    label: "Symbols",
    emojis: [
      "\u{2705}",
      "\u{274C}",
      "\u{2714}\u{FE0F}",
      "\u{2718}",
      "\u{2753}",
      "\u{2757}",
      "\u{1F4AF}",
      "\u{1F4A2}",
      "\u{1F4A4}",
      "\u{1F4AC}",
      "\u{1F4AD}",
      "\u{1F5E8}\u{FE0F}",
      "\u{2795}",
      "\u{2796}",
      "\u{2716}\u{FE0F}",
      "\u{2797}",
      "\u{27A1}\u{FE0F}",
      "\u{2B05}\u{FE0F}",
      "\u{2B06}\u{FE0F}",
      "\u{2B07}\u{FE0F}",
    ],
  },
} as const;

type CategoryKey = keyof typeof EMOJI_CATEGORIES;

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryKey>("smileys");

  const categories = Object.keys(EMOJI_CATEGORIES) as CategoryKey[];

  const categoryLabels: Record<CategoryKey, string> = {
    smileys: t("chat.emoji.smileys", "Smileys"),
    gestures: t("chat.emoji.gestures", "Gestures"),
    objects: t("chat.emoji.objects", "Objects"),
    nature: t("chat.emoji.nature", "Nature"),
    food: t("chat.emoji.food", "Food"),
    symbols: t("chat.emoji.symbols", "Symbols"),
  };

  return (
    <div className={cn("w-[280px]", className)}>
      {/* Category tabs */}
      <div className="flex gap-1 mb-2 pb-2 border-b border-border overflow-x-auto">
        {categories.map((key) => {
          const category = EMOJI_CATEGORIES[key];
          const firstEmoji = category.emojis[0];
          return (
            <Button
              key={key}
              variant={selectedCategory === key ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 text-base flex-shrink-0"
              onClick={() => setSelectedCategory(key)}
              title={categoryLabels[key]}
            >
              {firstEmoji}
            </Button>
          );
        })}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 max-h-[200px] overflow-y-auto">
        {EMOJI_CATEGORIES[selectedCategory].emojis.map((emoji, index) => (
          <button
            key={`${selectedCategory}-${index}`}
            type="button"
            className="h-8 w-8 flex items-center justify-center text-lg hover:bg-accent rounded transition-colors"
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
