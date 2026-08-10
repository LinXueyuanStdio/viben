import type { Chat, Session } from "@/lib/db/schema";

export type PageSessionResponse = {
  session: Session;
  chat: Chat;
  page: {
    published_page_id: string;
    user_slug: string;
    page_slug: string;
    title: string;
    url: string;
    can_edit: boolean;
    available: true;
  };
};
