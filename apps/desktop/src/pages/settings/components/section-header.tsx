export interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <h3 className="text-base font-semibold text-foreground mt-6 mb-2 first:mt-0">
      {title}
    </h3>
  );
}
