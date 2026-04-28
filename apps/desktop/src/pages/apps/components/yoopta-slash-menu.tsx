import { useTranslation } from "react-i18next";
import { SlashCommandMenu } from "@yoopta/ui/slash-command-menu";
import { BLOCK_ICONS, BLOCK_CATEGORIES, getCategoryOrder } from "./yoopta-constants";

export const YooptaSlashCommandMenu = () => {
  const { t } = useTranslation();
  return (
  <SlashCommandMenu>
    {(props) => {
      // Group items by category
      const grouped = new Map<string, typeof props.items>();
      for (const item of props.items) {
        const category = BLOCK_CATEGORIES[item.id] || t("editor.blockCategories.other", "Other");
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category)!.push(item);
      }

      // Sort groups by CATEGORY_ORDER
      const sortedGroups = [...grouped.entries()].sort(
        (a, b) =>
          getCategoryOrder().indexOf(a[0]) - getCategoryOrder().indexOf(b[0]),
      );

      return (
        <SlashCommandMenu.Content>
          <SlashCommandMenu.List>
            <SlashCommandMenu.Empty>{t("editor.slashMenu.noBlocksFound")}</SlashCommandMenu.Empty>
            {sortedGroups.map(([category, items]) => (
              <SlashCommandMenu.Group key={category} heading={category}>
                {items.map((item) => {
                  const Icon = BLOCK_ICONS[item.id];
                  return (
                    <SlashCommandMenu.Item
                      key={item.id}
                      value={item.id}
                      title={item.title}
                      description={item.description}
                      icon={Icon ? <Icon width={20} height={20} /> : null}
                    />
                  );
                })}
              </SlashCommandMenu.Group>
            ))}
          </SlashCommandMenu.List>
          <SlashCommandMenu.Footer />
        </SlashCommandMenu.Content>
      );
    }}
  </SlashCommandMenu>
  );
};
