/**
 * Icon Picker Constants
 *
 * Predefined Lucide icon list and mappings.
 */

import {
  FileText,
  File,
  Folder,
  FolderOpen,
  Book,
  BookOpen,
  Code,
  Code2,
  Globe,
  Home,
  Star,
  Heart,
  Bookmark,
  Settings,
  Image,
  Music,
  Video,
  Database,
  Cloud,
  Link,
  Smile,
  User,
  Users,
  Mail,
  Phone,
  Calendar,
  Clock,
  MapPin,
  Camera,
  Palette,
  Pencil,
  Edit,
  Trash2,
  Download,
  Upload,
  Share2,
  Search,
  Filter,
  Bell,
  MessageSquare,
  MessageCircle,
  Send,
  Inbox,
  Archive,
  Tag,
  Hash,
  AtSign,
  Lock,
  Unlock,
  Key,
  Shield,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Zap,
  Flame,
  Sparkles,
  Award,
  Trophy,
  Target,
  Flag,
  Pin,
  Layers,
  Layout,
  Grid,
  List,
  BarChart,
  PieChart,
  TrendingUp,
  Activity,
  Cpu,
  Server,
  Terminal,
  GitBranch,
  GitCommit,
  Package,
  Box,
  Briefcase,
  ShoppingCart,
  CreditCard,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import type { IconCategory } from "./types";

/**
 * Lucide icon name to component mapping
 */
export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  // Documents
  "file-text": FileText,
  "file": File,
  "folder": Folder,
  "folder-open": FolderOpen,
  "book": Book,
  "book-open": BookOpen,

  // Code & Development
  "code": Code,
  "code-2": Code2,
  "terminal": Terminal,
  "git-branch": GitBranch,
  "git-commit": GitCommit,
  "package": Package,
  "box": Box,
  "cpu": Cpu,
  "server": Server,
  "database": Database,

  // Navigation
  "globe": Globe,
  "home": Home,
  "map-pin": MapPin,
  "link": Link,

  // Favorites
  "star": Star,
  "heart": Heart,
  "bookmark": Bookmark,
  "pin": Pin,
  "flag": Flag,

  // Settings & Tools
  "settings": Settings,
  "pencil": Pencil,
  "edit": Edit,
  "search": Search,
  "filter": Filter,
  "trash-2": Trash2,

  // Media
  "image": Image,
  "camera": Camera,
  "music": Music,
  "video": Video,
  "palette": Palette,

  // Communication
  "mail": Mail,
  "phone": Phone,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  "send": Send,
  "inbox": Inbox,

  // People
  "user": User,
  "users": Users,
  "smile": Smile,

  // Time
  "calendar": Calendar,
  "clock": Clock,

  // Security
  "lock": Lock,
  "unlock": Unlock,
  "key": Key,
  "shield": Shield,
  "eye": Eye,
  "eye-off": EyeOff,

  // Actions
  "download": Download,
  "upload": Upload,
  "share-2": Share2,
  "archive": Archive,

  // Tags & Labels
  "tag": Tag,
  "hash": Hash,
  "at-sign": AtSign,

  // Weather & Nature
  "sun": Sun,
  "moon": Moon,
  "cloud": Cloud,
  "zap": Zap,
  "flame": Flame,
  "sparkles": Sparkles,

  // Achievement
  "award": Award,
  "trophy": Trophy,
  "target": Target,

  // Layout
  "layers": Layers,
  "layout": Layout,
  "grid": Grid,
  "list": List,

  // Charts
  "bar-chart": BarChart,
  "pie-chart": PieChart,
  "trending-up": TrendingUp,
  "activity": Activity,

  // Business
  "briefcase": Briefcase,
  "shopping-cart": ShoppingCart,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,

  // Notifications
  "bell": Bell,
};

/**
 * Icon categories for organized display
 */
export const LUCIDE_CATEGORIES: IconCategory[] = [
  {
    id: "documents",
    labelKey: "iconPicker.category.documents",
    icons: ["file-text", "file", "folder", "folder-open", "book", "book-open"],
  },
  {
    id: "code",
    labelKey: "iconPicker.category.code",
    icons: ["code", "code-2", "terminal", "git-branch", "database", "server", "cpu", "package"],
  },
  {
    id: "navigation",
    labelKey: "iconPicker.category.navigation",
    icons: ["home", "globe", "map-pin", "link", "search"],
  },
  {
    id: "favorites",
    labelKey: "iconPicker.category.favorites",
    icons: ["star", "heart", "bookmark", "pin", "flag"],
  },
  {
    id: "media",
    labelKey: "iconPicker.category.media",
    icons: ["image", "camera", "music", "video", "palette"],
  },
  {
    id: "communication",
    labelKey: "iconPicker.category.communication",
    icons: ["mail", "phone", "message-square", "message-circle", "send", "inbox", "bell"],
  },
  {
    id: "people",
    labelKey: "iconPicker.category.people",
    icons: ["user", "users", "smile"],
  },
  {
    id: "time",
    labelKey: "iconPicker.category.time",
    icons: ["calendar", "clock"],
  },
  {
    id: "security",
    labelKey: "iconPicker.category.security",
    icons: ["lock", "unlock", "key", "shield", "eye", "eye-off"],
  },
  {
    id: "actions",
    labelKey: "iconPicker.category.actions",
    icons: ["download", "upload", "share-2", "archive", "pencil", "edit", "settings", "trash-2", "filter"],
  },
  {
    id: "weather",
    labelKey: "iconPicker.category.weather",
    icons: ["sun", "moon", "cloud", "zap", "flame", "sparkles"],
  },
  {
    id: "achievement",
    labelKey: "iconPicker.category.achievement",
    icons: ["award", "trophy", "target"],
  },
  {
    id: "layout",
    labelKey: "iconPicker.category.layout",
    icons: ["layers", "layout", "grid", "list"],
  },
  {
    id: "charts",
    labelKey: "iconPicker.category.charts",
    icons: ["bar-chart", "pie-chart", "trending-up", "activity"],
  },
  {
    id: "business",
    labelKey: "iconPicker.category.business",
    icons: ["briefcase", "shopping-cart", "credit-card", "dollar-sign", "tag", "hash"],
  },
  {
    id: "other",
    labelKey: "iconPicker.category.other",
    icons: [], // Dynamically filled at runtime
  },
];

/**
 * Set of icon names that have been manually categorized.
 * Used to determine which icons go into the "Other" category.
 */
export const CATEGORIZED_ICON_NAMES = new Set(
  LUCIDE_CATEGORIES.filter((c) => c.id !== "other")
    .flatMap((c) => c.icons)
);

/**
 * Default icon when no icon is specified
 */
export const DEFAULT_ICON_NAME = "file-text";

/**
 * Size mapping for icon display
 */
export const ICON_SIZE_MAP: Record<string, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};
