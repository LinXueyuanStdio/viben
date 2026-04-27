import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmojiEntry {
  emoji: string;
  name: string;
  keywords: string[];
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiEntry[];
}

interface EmojiPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  currentEmoji?: string;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Emoji dataset (~200 emojis across 8 categories)
// ---------------------------------------------------------------------------

const EMOJI_DATA: EmojiCategory[] = [
  {
    id: "smileys",
    name: "Smileys & People",
    icon: "\uD83D\uDE00",
    emojis: [
      { emoji: "\uD83D\uDE00", name: "grinning face", keywords: ["happy", "smile", "joy"] },
      { emoji: "\uD83D\uDE03", name: "grinning face with big eyes", keywords: ["happy", "smile"] },
      { emoji: "\uD83D\uDE04", name: "grinning face with smiling eyes", keywords: ["happy", "joy"] },
      { emoji: "\uD83D\uDE01", name: "beaming face", keywords: ["happy", "grin"] },
      { emoji: "\uD83D\uDE06", name: "grinning squinting face", keywords: ["laugh", "happy"] },
      { emoji: "\uD83D\uDE05", name: "grinning face with sweat", keywords: ["hot", "relief"] },
      { emoji: "\uD83E\uDD23", name: "rolling on the floor laughing", keywords: ["laugh", "rofl"] },
      { emoji: "\uD83D\uDE02", name: "face with tears of joy", keywords: ["laugh", "cry", "happy"] },
      { emoji: "\uD83D\uDE42", name: "slightly smiling face", keywords: ["smile"] },
      { emoji: "\uD83D\uDE43", name: "upside-down face", keywords: ["silly", "sarcasm"] },
      { emoji: "\uD83D\uDE09", name: "winking face", keywords: ["wink", "flirt"] },
      { emoji: "\uD83D\uDE0A", name: "smiling face with smiling eyes", keywords: ["blush", "happy"] },
      { emoji: "\uD83D\uDE07", name: "smiling face with halo", keywords: ["angel", "innocent"] },
      { emoji: "\uD83E\uDD70", name: "smiling face with hearts", keywords: ["love", "adore"] },
      { emoji: "\uD83D\uDE0D", name: "heart eyes", keywords: ["love", "crush", "adore"] },
      { emoji: "\uD83E\uDD29", name: "star-struck", keywords: ["star", "eyes", "wow"] },
      { emoji: "\uD83D\uDE18", name: "face blowing a kiss", keywords: ["kiss", "love"] },
      { emoji: "\uD83D\uDE1C", name: "winking face with tongue", keywords: ["tongue", "playful"] },
      { emoji: "\uD83E\uDD14", name: "thinking face", keywords: ["think", "hmm"] },
      { emoji: "\uD83E\uDD28", name: "face with raised eyebrow", keywords: ["skeptical", "doubt"] },
      { emoji: "\uD83D\uDE10", name: "neutral face", keywords: ["meh", "blank"] },
      { emoji: "\uD83D\uDE11", name: "expressionless face", keywords: ["blank", "flat"] },
      { emoji: "\uD83D\uDE36", name: "face without mouth", keywords: ["silent", "mute"] },
      { emoji: "\uD83D\uDE44", name: "face with rolling eyes", keywords: ["eyeroll", "annoyed"] },
      { emoji: "\uD83D\uDE2C", name: "grimacing face", keywords: ["awkward", "nervous"] },
      { emoji: "\uD83D\uDE34", name: "sleeping face", keywords: ["sleep", "zzz", "tired"] },
      { emoji: "\uD83E\uDD73", name: "partying face", keywords: ["party", "celebrate"] },
      { emoji: "\uD83D\uDE0E", name: "smiling face with sunglasses", keywords: ["cool", "sunglasses"] },
      { emoji: "\uD83E\uDD13", name: "nerd face", keywords: ["nerd", "glasses", "geek"] },
      { emoji: "\uD83D\uDE31", name: "face screaming in fear", keywords: ["scared", "shock", "scream"] },
    ],
  },
  {
    id: "animals",
    name: "Animals & Nature",
    icon: "\uD83D\uDC3B",
    emojis: [
      { emoji: "\uD83D\uDC36", name: "dog face", keywords: ["pet", "puppy", "dog"] },
      { emoji: "\uD83D\uDC31", name: "cat face", keywords: ["pet", "kitten", "cat"] },
      { emoji: "\uD83D\uDC2D", name: "mouse face", keywords: ["mouse", "rodent"] },
      { emoji: "\uD83D\uDC39", name: "hamster", keywords: ["hamster", "pet"] },
      { emoji: "\uD83D\uDC30", name: "rabbit face", keywords: ["bunny", "rabbit"] },
      { emoji: "\uD83E\uDD8A", name: "fox", keywords: ["fox", "clever"] },
      { emoji: "\uD83D\uDC3B", name: "bear", keywords: ["bear", "animal"] },
      { emoji: "\uD83D\uDC3C", name: "panda", keywords: ["panda", "bear", "cute"] },
      { emoji: "\uD83D\uDC28", name: "koala", keywords: ["koala", "animal"] },
      { emoji: "\uD83D\uDC2F", name: "tiger face", keywords: ["tiger", "cat"] },
      { emoji: "\uD83E\uDD81", name: "lion", keywords: ["lion", "king", "cat"] },
      { emoji: "\uD83D\uDC2E", name: "cow face", keywords: ["cow", "farm"] },
      { emoji: "\uD83D\uDC37", name: "pig face", keywords: ["pig", "farm"] },
      { emoji: "\uD83D\uDC38", name: "frog", keywords: ["frog", "amphibian"] },
      { emoji: "\uD83D\uDC35", name: "monkey face", keywords: ["monkey", "primate"] },
      { emoji: "\uD83D\uDC14", name: "chicken", keywords: ["chicken", "bird", "farm"] },
      { emoji: "\uD83E\uDD86", name: "duck", keywords: ["duck", "bird"] },
      { emoji: "\uD83E\uDD85", name: "eagle", keywords: ["eagle", "bird"] },
      { emoji: "\uD83E\uDD89", name: "owl", keywords: ["owl", "wise", "bird"] },
      { emoji: "\uD83D\uDC1D", name: "honeybee", keywords: ["bee", "insect", "honey"] },
      { emoji: "\uD83E\uDD8B", name: "butterfly", keywords: ["butterfly", "insect", "pretty"] },
      { emoji: "\uD83C\uDF39", name: "rose", keywords: ["flower", "rose", "love"] },
      { emoji: "\uD83C\uDF3B", name: "sunflower", keywords: ["flower", "sun"] },
      { emoji: "\uD83C\uDF33", name: "deciduous tree", keywords: ["tree", "nature"] },
      { emoji: "\uD83C\uDF35", name: "cactus", keywords: ["cactus", "desert", "plant"] },
    ],
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: "\uD83C\uDF4E",
    emojis: [
      { emoji: "\uD83C\uDF4E", name: "red apple", keywords: ["apple", "fruit"] },
      { emoji: "\uD83C\uDF4A", name: "tangerine", keywords: ["orange", "fruit", "citrus"] },
      { emoji: "\uD83C\uDF4B", name: "lemon", keywords: ["lemon", "fruit", "citrus"] },
      { emoji: "\uD83C\uDF4C", name: "banana", keywords: ["banana", "fruit"] },
      { emoji: "\uD83C\uDF49", name: "watermelon", keywords: ["watermelon", "fruit", "summer"] },
      { emoji: "\uD83C\uDF47", name: "grapes", keywords: ["grapes", "fruit", "wine"] },
      { emoji: "\uD83C\uDF53", name: "strawberry", keywords: ["strawberry", "fruit", "berry"] },
      { emoji: "\uD83C\uDF51", name: "peach", keywords: ["peach", "fruit"] },
      { emoji: "\uD83C\uDF52", name: "cherries", keywords: ["cherry", "fruit"] },
      { emoji: "\uD83E\uDD51", name: "avocado", keywords: ["avocado", "fruit", "guacamole"] },
      { emoji: "\uD83C\uDF55", name: "pizza", keywords: ["pizza", "food", "italian"] },
      { emoji: "\uD83C\uDF54", name: "hamburger", keywords: ["burger", "food", "fast food"] },
      { emoji: "\uD83C\uDF5F", name: "french fries", keywords: ["fries", "food", "fast food"] },
      { emoji: "\uD83C\uDF2E", name: "taco", keywords: ["taco", "food", "mexican"] },
      { emoji: "\uD83C\uDF63", name: "sushi", keywords: ["sushi", "food", "japanese"] },
      { emoji: "\uD83C\uDF5C", name: "steaming bowl", keywords: ["noodles", "ramen", "food"] },
      { emoji: "\uD83C\uDF70", name: "shortcake", keywords: ["cake", "dessert", "sweet"] },
      { emoji: "\uD83C\uDF69", name: "doughnut", keywords: ["donut", "dessert", "sweet"] },
      { emoji: "\uD83C\uDF6B", name: "chocolate bar", keywords: ["chocolate", "sweet"] },
      { emoji: "\uD83C\uDF66", name: "soft ice cream", keywords: ["ice cream", "dessert", "sweet"] },
      { emoji: "\u2615", name: "hot beverage", keywords: ["coffee", "tea", "drink"] },
      { emoji: "\uD83C\uDF75", name: "teacup", keywords: ["tea", "drink", "green tea"] },
      { emoji: "\uD83C\uDF7A", name: "beer mug", keywords: ["beer", "drink", "alcohol"] },
      { emoji: "\uD83C\uDF77", name: "wine glass", keywords: ["wine", "drink", "alcohol"] },
      { emoji: "\uD83E\uDD64", name: "cup with straw", keywords: ["drink", "juice", "soda"] },
    ],
  },
  {
    id: "activities",
    name: "Activities",
    icon: "\u26BD",
    emojis: [
      { emoji: "\u26BD", name: "soccer ball", keywords: ["soccer", "football", "sport"] },
      { emoji: "\uD83C\uDFC0", name: "basketball", keywords: ["basketball", "sport"] },
      { emoji: "\uD83C\uDFC8", name: "american football", keywords: ["football", "sport"] },
      { emoji: "\u26BE", name: "baseball", keywords: ["baseball", "sport"] },
      { emoji: "\uD83C\uDFBE", name: "tennis", keywords: ["tennis", "sport"] },
      { emoji: "\uD83C\uDFD0", name: "volleyball", keywords: ["volleyball", "sport"] },
      { emoji: "\uD83C\uDFC9", name: "rugby football", keywords: ["rugby", "sport"] },
      { emoji: "\uD83C\uDFB1", name: "pool 8 ball", keywords: ["billiards", "pool", "game"] },
      { emoji: "\uD83C\uDFD3", name: "ping pong", keywords: ["table tennis", "sport"] },
      { emoji: "\uD83C\uDFF8", name: "badminton", keywords: ["badminton", "sport"] },
      { emoji: "\uD83E\uDD4A", name: "boxing glove", keywords: ["boxing", "sport", "fight"] },
      { emoji: "\uD83C\uDFBF", name: "skis", keywords: ["ski", "winter", "sport"] },
      { emoji: "\uD83C\uDFC4", name: "person surfing", keywords: ["surf", "sport", "ocean"] },
      { emoji: "\uD83C\uDFCA", name: "person swimming", keywords: ["swim", "sport", "water"] },
      { emoji: "\uD83D\uDEB4", name: "person biking", keywords: ["bike", "cycling", "sport"] },
      { emoji: "\uD83C\uDFAF", name: "bullseye", keywords: ["target", "dart", "aim"] },
      { emoji: "\uD83C\uDFB3", name: "bowling", keywords: ["bowling", "sport"] },
      { emoji: "\uD83C\uDFAE", name: "video game", keywords: ["game", "controller", "gaming"] },
      { emoji: "\uD83C\uDFB2", name: "game die", keywords: ["dice", "game", "luck"] },
      { emoji: "\uD83E\uDDE9", name: "puzzle piece", keywords: ["puzzle", "game", "jigsaw"] },
      { emoji: "\uD83C\uDFAD", name: "performing arts", keywords: ["theater", "drama", "mask"] },
      { emoji: "\uD83C\uDFA8", name: "artist palette", keywords: ["art", "paint", "creative"] },
      { emoji: "\uD83C\uDFB5", name: "musical note", keywords: ["music", "note", "sound"] },
      { emoji: "\uD83C\uDFB8", name: "guitar", keywords: ["guitar", "music", "rock"] },
      { emoji: "\uD83C\uDFB9", name: "musical keyboard", keywords: ["piano", "music", "keyboard"] },
    ],
  },
  {
    id: "travel",
    name: "Travel & Places",
    icon: "\uD83C\uDFE0",
    emojis: [
      { emoji: "\uD83C\uDFE0", name: "house", keywords: ["home", "house", "building"] },
      { emoji: "\uD83C\uDFE2", name: "office building", keywords: ["office", "work", "building"] },
      { emoji: "\uD83C\uDFEB", name: "school", keywords: ["school", "education", "building"] },
      { emoji: "\uD83C\uDFE5", name: "hospital", keywords: ["hospital", "health", "building"] },
      { emoji: "\uD83C\uDFEA", name: "convenience store", keywords: ["store", "shop", "building"] },
      { emoji: "\u26EA", name: "church", keywords: ["church", "religion", "building"] },
      { emoji: "\uD83D\uDD4C", name: "mosque", keywords: ["mosque", "religion", "building"] },
      { emoji: "\uD83C\uDFEF", name: "japanese castle", keywords: ["castle", "japan", "building"] },
      { emoji: "\uD83D\uDE97", name: "automobile", keywords: ["car", "vehicle", "drive"] },
      { emoji: "\uD83D\uDE95", name: "taxi", keywords: ["taxi", "cab", "vehicle"] },
      { emoji: "\uD83D\uDE8C", name: "bus", keywords: ["bus", "vehicle", "transit"] },
      { emoji: "\uD83D\uDE82", name: "locomotive", keywords: ["train", "rail", "vehicle"] },
      { emoji: "\u2708\uFE0F", name: "airplane", keywords: ["plane", "fly", "travel"] },
      { emoji: "\uD83D\uDE80", name: "rocket", keywords: ["rocket", "space", "launch"] },
      { emoji: "\uD83D\uDEF8", name: "flying saucer", keywords: ["ufo", "alien", "space"] },
      { emoji: "\uD83D\uDEA2", name: "ship", keywords: ["ship", "boat", "cruise"] },
      { emoji: "\u26F5", name: "sailboat", keywords: ["boat", "sail", "ocean"] },
      { emoji: "\uD83C\uDF0D", name: "globe europe-africa", keywords: ["earth", "world", "globe"] },
      { emoji: "\uD83C\uDF04", name: "sunrise over mountains", keywords: ["sunrise", "morning", "mountain"] },
      { emoji: "\uD83C\uDF05", name: "sunrise", keywords: ["sunrise", "morning"] },
      { emoji: "\uD83C\uDF03", name: "night with stars", keywords: ["night", "stars", "city"] },
      { emoji: "\uD83C\uDF08", name: "rainbow", keywords: ["rainbow", "weather", "sky"] },
      { emoji: "\u2744\uFE0F", name: "snowflake", keywords: ["snow", "winter", "cold"] },
      { emoji: "\uD83C\uDF19", name: "crescent moon", keywords: ["moon", "night", "sleep"] },
      { emoji: "\u2B50", name: "star", keywords: ["star", "night", "favorite"] },
    ],
  },
  {
    id: "objects",
    name: "Objects",
    icon: "\uD83D\uDCA1",
    emojis: [
      { emoji: "\uD83D\uDCA1", name: "light bulb", keywords: ["idea", "light", "bulb"] },
      { emoji: "\uD83D\uDD0D", name: "magnifying glass left", keywords: ["search", "find", "look"] },
      { emoji: "\uD83D\uDD12", name: "locked", keywords: ["lock", "secure", "private"] },
      { emoji: "\uD83D\uDD13", name: "unlocked", keywords: ["unlock", "open"] },
      { emoji: "\uD83D\uDD11", name: "key", keywords: ["key", "lock", "password"] },
      { emoji: "\uD83D\uDCE7", name: "e-mail", keywords: ["email", "mail", "message"] },
      { emoji: "\uD83D\uDCE6", name: "package", keywords: ["package", "box", "delivery"] },
      { emoji: "\uD83D\uDCDA", name: "books", keywords: ["books", "library", "read"] },
      { emoji: "\uD83D\uDCD6", name: "open book", keywords: ["book", "read", "study"] },
      { emoji: "\uD83D\uDCDD", name: "memo", keywords: ["note", "write", "memo", "pencil"] },
      { emoji: "\uD83D\uDCCB", name: "clipboard", keywords: ["clipboard", "list", "note"] },
      { emoji: "\uD83D\uDCC5", name: "calendar", keywords: ["calendar", "date", "schedule"] },
      { emoji: "\uD83D\uDCCA", name: "bar chart", keywords: ["chart", "graph", "data"] },
      { emoji: "\uD83D\uDCC1", name: "file folder", keywords: ["folder", "file", "directory"] },
      { emoji: "\u2702\uFE0F", name: "scissors", keywords: ["scissors", "cut"] },
      { emoji: "\uD83D\uDCCE", name: "paperclip", keywords: ["paperclip", "attach"] },
      { emoji: "\uD83D\uDCBB", name: "laptop", keywords: ["laptop", "computer", "tech"] },
      { emoji: "\uD83D\uDCF1", name: "mobile phone", keywords: ["phone", "mobile", "cell"] },
      { emoji: "\u231A", name: "watch", keywords: ["watch", "time", "clock"] },
      { emoji: "\uD83D\uDCF7", name: "camera", keywords: ["camera", "photo", "picture"] },
      { emoji: "\uD83C\uDFA5", name: "movie camera", keywords: ["movie", "film", "video"] },
      { emoji: "\uD83D\uDD27", name: "wrench", keywords: ["wrench", "tool", "fix"] },
      { emoji: "\uD83D\uDD28", name: "hammer", keywords: ["hammer", "tool", "build"] },
      { emoji: "\u2699\uFE0F", name: "gear", keywords: ["gear", "settings", "cog"] },
      { emoji: "\uD83D\uDEA8", name: "police car light", keywords: ["alert", "emergency", "warning"] },
    ],
  },
  {
    id: "symbols",
    name: "Symbols",
    icon: "\u2764\uFE0F",
    emojis: [
      { emoji: "\u2764\uFE0F", name: "red heart", keywords: ["heart", "love", "red"] },
      { emoji: "\uD83E\uDDE1", name: "orange heart", keywords: ["heart", "love", "orange"] },
      { emoji: "\uD83D\uDC9B", name: "yellow heart", keywords: ["heart", "love", "yellow"] },
      { emoji: "\uD83D\uDC9A", name: "green heart", keywords: ["heart", "love", "green"] },
      { emoji: "\uD83D\uDC99", name: "blue heart", keywords: ["heart", "love", "blue"] },
      { emoji: "\uD83D\uDC9C", name: "purple heart", keywords: ["heart", "love", "purple"] },
      { emoji: "\uD83D\uDDA4", name: "black heart", keywords: ["heart", "love", "black"] },
      { emoji: "\u2705", name: "check mark", keywords: ["check", "done", "yes", "complete"] },
      { emoji: "\u274C", name: "cross mark", keywords: ["cross", "no", "wrong", "cancel"] },
      { emoji: "\u2757", name: "exclamation mark", keywords: ["exclamation", "warning", "important"] },
      { emoji: "\u2753", name: "question mark", keywords: ["question", "help", "ask"] },
      { emoji: "\uD83D\uDCAF", name: "hundred points", keywords: ["hundred", "perfect", "score"] },
      { emoji: "\uD83D\uDD25", name: "fire", keywords: ["fire", "hot", "lit", "flame"] },
      { emoji: "\u2728", name: "sparkles", keywords: ["sparkle", "magic", "star", "shine"] },
      { emoji: "\uD83C\uDF1F", name: "glowing star", keywords: ["star", "glow", "bright"] },
      { emoji: "\uD83D\uDCAB", name: "dizzy", keywords: ["star", "dizzy", "swirl"] },
      { emoji: "\uD83D\uDCA5", name: "collision", keywords: ["boom", "explosion", "crash"] },
      { emoji: "\uD83D\uDC4D", name: "thumbs up", keywords: ["like", "approve", "yes", "thumb"] },
      { emoji: "\uD83D\uDC4E", name: "thumbs down", keywords: ["dislike", "no", "thumb"] },
      { emoji: "\uD83D\uDC4F", name: "clapping hands", keywords: ["clap", "applause", "bravo"] },
      { emoji: "\uD83D\uDE4F", name: "folded hands", keywords: ["pray", "please", "thanks", "hope"] },
      { emoji: "\uD83D\uDCAA", name: "flexed biceps", keywords: ["strong", "muscle", "power"] },
      { emoji: "\u267B\uFE0F", name: "recycling symbol", keywords: ["recycle", "environment", "green"] },
      { emoji: "\u269B\uFE0F", name: "atom symbol", keywords: ["atom", "science", "physics"] },
      { emoji: "\u262E\uFE0F", name: "peace symbol", keywords: ["peace", "calm"] },
    ],
  },
  {
    id: "flags",
    name: "Flags",
    icon: "\uD83C\uDFC1",
    emojis: [
      { emoji: "\uD83C\uDFC1", name: "chequered flag", keywords: ["flag", "race", "finish"] },
      { emoji: "\uD83C\uDFF3\uFE0F", name: "white flag", keywords: ["flag", "surrender", "peace"] },
      { emoji: "\uD83C\uDFF4", name: "black flag", keywords: ["flag", "pirate"] },
      { emoji: "\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08", name: "rainbow flag", keywords: ["flag", "rainbow", "pride"] },
      { emoji: "\uD83C\uDDFA\uD83C\uDDF8", name: "flag united states", keywords: ["flag", "us", "usa", "america"] },
      { emoji: "\uD83C\uDDEC\uD83C\uDDE7", name: "flag united kingdom", keywords: ["flag", "uk", "britain"] },
      { emoji: "\uD83C\uDDE9\uD83C\uDDEA", name: "flag germany", keywords: ["flag", "germany", "de"] },
      { emoji: "\uD83C\uDDEB\uD83C\uDDF7", name: "flag france", keywords: ["flag", "france", "fr"] },
      { emoji: "\uD83C\uDDEA\uD83C\uDDF8", name: "flag spain", keywords: ["flag", "spain", "es"] },
      { emoji: "\uD83C\uDDEE\uD83C\uDDF9", name: "flag italy", keywords: ["flag", "italy", "it"] },
      { emoji: "\uD83C\uDDEF\uD83C\uDDF5", name: "flag japan", keywords: ["flag", "japan", "jp"] },
      { emoji: "\uD83C\uDDF0\uD83C\uDDF7", name: "flag south korea", keywords: ["flag", "korea", "kr"] },
      { emoji: "\uD83C\uDDE8\uD83C\uDDF3", name: "flag china", keywords: ["flag", "china", "cn"] },
      { emoji: "\uD83C\uDDE7\uD83C\uDDF7", name: "flag brazil", keywords: ["flag", "brazil", "br"] },
      { emoji: "\uD83C\uDDE8\uD83C\uDDE6", name: "flag canada", keywords: ["flag", "canada", "ca"] },
      { emoji: "\uD83C\uDDE6\uD83C\uDDFA", name: "flag australia", keywords: ["flag", "australia", "au"] },
      { emoji: "\uD83C\uDDEE\uD83C\uDDF3", name: "flag india", keywords: ["flag", "india", "in"] },
      { emoji: "\uD83C\uDDF7\uD83C\uDDFA", name: "flag russia", keywords: ["flag", "russia", "ru"] },
      { emoji: "\uD83C\uDDF2\uD83C\uDDFD", name: "flag mexico", keywords: ["flag", "mexico", "mx"] },
      { emoji: "\uD83C\uDDF8\uD83C\uDDEA", name: "flag sweden", keywords: ["flag", "sweden", "se"] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmojiPicker({
  open,
  onOpenChange,
  onSelect,
  onRemove,
  currentEmoji,
  children,
}: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>(EMOJI_DATA[0].id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isScrollingToCategory = useRef(false);

  // Reset search when popover opens
  useEffect(() => {
    console.log("[DEBUG:EmojiPicker] open changed:", open);
    if (open) {
      setSearch("");
      setActiveCategoryId(EMOJI_DATA[0].id);
      // Focus search input after popover opens
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  // Filtered emojis for search mode
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase().trim();
    const results: EmojiEntry[] = [];
    for (const category of EMOJI_DATA) {
      for (const entry of category.emojis) {
        if (
          entry.name.toLowerCase().includes(query) ||
          entry.keywords.some((kw) => kw.toLowerCase().includes(query))
        ) {
          results.push(entry);
        }
      }
    }
    return results;
  }, [search]);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategoryId(categoryId);
    const el = categoryRefs.current[categoryId];
    if (el && scrollRef.current) {
      isScrollingToCategory.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Reset flag after scroll animation likely finishes
      setTimeout(() => {
        isScrollingToCategory.current = false;
      }, 400);
    }
  }, []);

  // Track which category is in view while scrolling
  const handleScroll = useCallback(() => {
    if (isScrollingToCategory.current || !scrollRef.current) return;

    const container = scrollRef.current;
    const scrollTop = container.scrollTop;

    let currentId = EMOJI_DATA[0].id;
    for (const category of EMOJI_DATA) {
      const el = categoryRefs.current[category.id];
      if (el) {
        // Offset by a few pixels to trigger earlier
        if (el.offsetTop - container.offsetTop <= scrollTop + 8) {
          currentId = category.id;
        }
      }
    }
    setActiveCategoryId(currentId);
  }, []);

  const isSearching = searchResults !== null;

  return (
    <Popover open={open} onOpenChange={(v) => { console.log("[DEBUG:EmojiPicker] Popover onOpenChange:", v); onOpenChange(v); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 p-0 shadow-lg"
        onOpenAutoFocus={(e) => {
          // Prevent default focus behavior so we can focus search input
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <div className="flex flex-col" style={{ maxHeight: 400 }}>
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Category tabs */}
          {!isSearching && (
            <div className="flex items-center gap-0.5 border-b px-2 py-1">
              {EMOJI_DATA.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => handleCategoryClick(category.id)}
                  title={category.name}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm transition-colors",
                    activeCategoryId === category.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {category.icon}
                </button>
              ))}
            </div>
          )}

          {/* Emoji grid area */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1"
            style={{ maxHeight: 300 }}
          >
            {isSearching ? (
              // Search results: flat grid
              searchResults.length > 0 ? (
                <div className="grid grid-cols-9 gap-0.5 py-1">
                  {searchResults.map((entry, i) => (
                    <EmojiButton key={`${entry.emoji}-${i}`} entry={entry} onSelect={handleSelect} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  No emojis found
                </div>
              )
            ) : (
              // Category grid
              EMOJI_DATA.map((category) => (
                <div
                  key={category.id}
                  ref={(el) => {
                    categoryRefs.current[category.id] = el;
                  }}
                >
                  <div className="sticky top-0 z-10 bg-popover/95 px-1 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    {category.name}
                  </div>
                  <div className="grid grid-cols-9 gap-0.5">
                    {category.emojis.map((entry, i) => (
                      <EmojiButton key={`${entry.emoji}-${i}`} entry={entry} onSelect={handleSelect} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Remove button */}
          {currentEmoji && onRemove && (
            <div className="border-t px-3 py-2">
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" />
                Remove
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Emoji button (extracted for readability)
// ---------------------------------------------------------------------------

function EmojiButton({
  entry,
  onSelect,
}: {
  entry: EmojiEntry;
  onSelect: (emoji: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.emoji)}
      title={entry.name}
      className="flex h-8 w-8 items-center justify-center rounded text-lg transition-colors hover:bg-muted"
    >
      {entry.emoji}
    </button>
  );
}
