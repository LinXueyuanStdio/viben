import { HeadingOne, HeadingThree, HeadingTwo } from '@yoopta/headings';
import Code from '@yoopta/code';
import Table from '@yoopta/table';
import Accordion from '@yoopta/accordion';
import Divider from '@yoopta/divider';
import Paragraph from '@yoopta/paragraph';
import Blockquote from '@yoopta/blockquote';
import Callout from '@yoopta/callout';
import Link from '@yoopta/link';
import { NumberedList, BulletedList, TodoList } from '@yoopta/lists';
import Embed from '@yoopta/embed';
import Image from '@yoopta/image';
import Video from '@yoopta/video';
import Emoji from '@yoopta/emoji';
import File from '@yoopta/file';
import Tabs from '@yoopta/tabs';
import Steps from '@yoopta/steps';
import Carousel from '@yoopta/carousel';
import Mention from '@yoopta/mention';
import { MathInline, MathBlock } from '@yoopta/math';
import TableOfContents from '@yoopta/table-of-contents';
import type { YooptaNavigationMeta } from "@/navigation/page-navigation-extractor";

import 'katex/dist/katex.min.css';

export interface YooptaPluginOptions {
  uploadAsset?: (file: File) => Promise<string>;
  searchPages?: (query: string) => Promise<{ id: string; name: string; avatar: string }[]>;
  buildPageHref?: (pageSlug: string) => string;
  buildPageMeta?: (pageSlug: string) => YooptaNavigationMeta | undefined;
}

/**
 * Create Yoopta plugins with optional handlers for upload and search.
 *
 * @param uploadAsset - Uploads a File and returns a persistent URL.
 * @param searchPages - Searches workspace pages by query for # mentions.
 */
export function createYooptaPlugins(options: YooptaPluginOptions = {}) {
  const {
    uploadAsset,
    searchPages,
    buildPageHref,
    buildPageMeta,
  } = options;
  const YImage = Image.extend({
    options: {
      upload: async (file: globalThis.File) => {
        const src = uploadAsset ? await uploadAsset(file) : URL.createObjectURL(file);
        return {
          id: file.name,
          src,
          alt: file.name,
          fit: 'cover' as const,
          sizes: {
            width: 0,
            height: 0,
          },
        };
      },
    },
  });

  return [
    TableOfContents,
    File.extend({
      options: {
        upload: async (file: globalThis.File) => {
          const src = uploadAsset ? await uploadAsset(file) : URL.createObjectURL(file);
          return {
            id: file.name,
            src,
            name: file.name,
            size: file.size,
            format: file.name.split('.').pop(),
          };
        },
      },
    }),
    Code.Code,
    Code.CodeGroup,
    Table,
    Accordion,
    Divider,
    Paragraph.extend({
      elements: {
        paragraph: {
          placeholder: "Type '/' for commands...",
        },
      },
    }),
    HeadingOne.extend({
      elements: {
        'heading-one': {
          placeholder: 'Heading 1',
        },
      },
    }),
    HeadingTwo.extend({
      elements: {
        'heading-two': {
          placeholder: 'Heading 2',
        },
      },
    }),
    HeadingThree.extend({
      elements: {
        'heading-three': {
          placeholder: 'Heading 3',
        },
      },
    }),
    Blockquote.extend({
      elements: {
        blockquote: {
          placeholder: 'Quote',
        },
      },
    }),
    Callout.extend({
      elements: {
        callout: {
          placeholder: 'Type something...',
        },
      },
    }),
    Link,
    NumberedList.extend({
      elements: {
        'numbered-list': {
          placeholder: 'List',
        },
      },
    }),
    BulletedList.extend({
      elements: {
        'bulleted-list': {
          placeholder: 'List',
        },
      },
    }),
    TodoList.extend({
      elements: {
        'todo-list': {
          placeholder: 'To-do',
        },
      },
    }),
    Embed,
    Emoji,
    YImage,
    Video.extend({
      options: {
        upload: async (file: globalThis.File) => {
          const src = uploadAsset ? await uploadAsset(file) : URL.createObjectURL(file);
          return {
            id: file.name,
            src,
            name: file.name,
            size: file.size,
            format: file.name.split('.').pop(),
          };
        },
      },
    }),
    Steps.extend({
      elements: {
        'step-list-item-heading': {
          placeholder: 'Step title',
        },
        'step-list-item-content': {
          placeholder: 'Describe this step...',
        },
      },
    }),
    Carousel.extend({
      injectElementsFromPlugins: [YImage],
    }),
    Tabs,
    Mention.extend({
      options: {
        onSearch: async (query: string, trigger: { type?: string }) => {
          const q = query.toLowerCase();
          if (trigger.type === 'page' && searchPages) {
            try {
              const results = await searchPages(q);
              return results.map((page) => {
                const meta = buildPageMeta?.(page.id);
                return {
                  ...page,
                  meta: {
                    ...(meta ?? {}),
                    url: buildPageHref?.(page.id),
                  },
                };
              });
            } catch {
              return [];
            }
          }
          if (trigger.type === 'page') {
            return [];
          }
          // Single-user desktop app
          const users = [
            { id: 'user-1', name: 'You', avatar: '' },
          ];
          return q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
        },
        triggers: [
          { char: '@', type: 'user' },
          { char: '#', type: 'page' },
        ],
      },
    }),
    MathInline,
    MathBlock,
  ];
}

/** Default plugins (backward compatibility, uses ephemeral blob URLs) */
export const YOOPTA_PLUGINS = createYooptaPlugins();
