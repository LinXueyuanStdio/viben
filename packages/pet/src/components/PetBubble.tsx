import type { CSSProperties, ReactNode } from 'react';

export interface PetBubbleProps {
  name: string;
  children: ReactNode;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}

export function PetBubble({
  name,
  children,
  accent = '#6366f1',
  className = '',
  style,
}: PetBubbleProps) {
  return (
    <div
      className={`pet-bubble ${className}`}
      role="status"
      style={{ '--pet-accent': accent, ...style } as CSSProperties}
    >
      <div className="pet-bubble-name">{name}</div>
      <div className="pet-bubble-line">{children}</div>
    </div>
  );
}
