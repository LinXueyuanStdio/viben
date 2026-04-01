import { Apple, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils/index';

interface OsIconProps {
  os: string;
  className?: string;
}

/**
 * OsIcon displays an icon based on the operating system
 */
export function OsIcon({ os, className }: OsIconProps) {
  const iconClassName = cn('h-3 w-3', className);

  switch (os.toLowerCase()) {
    case 'macos':
    case 'darwin':
      return <Apple className={iconClassName} />;
    case 'linux':
    case 'windows':
    default:
      return <Monitor className={iconClassName} />;
  }
}
