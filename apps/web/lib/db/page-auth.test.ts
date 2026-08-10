import { describe, expect, test, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const fixtures = vi.hoisted(() => ({
  pages: [
    {
      id: "page-personal",
      uid: "guide",
      userId: "personal-owner",
      authorSlug: "alice",
    },
    {
      id: "page-team",
      uid: "guide",
      userId: "team-owner",
      authorSlug: "acme",
    },
  ],
}));

const dialect = new PgDialect();

function queryParams(where: SQL): unknown[] {
  return dialect.sqlToQuery(where).params;
}

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();

  return {
    ...actual,
    db: {
      query: {
        publishedPages: {
          findFirst: async ({ where }: { where: SQL }) => {
            const params = queryParams(where);
            return fixtures.pages.find((page) =>
              params.every((param) => Object.values(page).includes(param)),
            );
          },
        },
        users: {
          findFirst: async ({ where }: { where: SQL }) => {
            const [userId] = queryParams(where);
            return userId === "team-owner" ? { type: "team" } : { type: "user" };
          },
        },
        teamMembers: {
          findFirst: async ({ where }: { where: SQL }) => {
            const params = queryParams(where);
            return params.includes("team-owner") && params.includes("member-1")
              ? { role: "member" }
              : undefined;
          },
        },
      },
    },
  };
});

const pageAuthModulePromise = import("./page-auth");

describe("findEditablePage", () => {
  test("finds the target team page by stable id when another author uses the same uid", async () => {
    const { findEditablePage } = await pageAuthModulePromise;

    const page = await findEditablePage("guide", "member-1", {
      publishedPageId: "page-team",
    });

    expect(page?.id).toBe("page-team");
  });
});
