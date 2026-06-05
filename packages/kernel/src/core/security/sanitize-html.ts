/**
 * HTML sanitization for agent output sent to Telegram.
 *
 * Telegram's HTML mode renders a subset of tags for message formatting.
 * Agent responses can contain arbitrary HTML from markdown conversion,
 * which may include script tags, event handlers, or malformed markup
 * that would break Telegram's parser. This module strips everything
 * except safe formatting and structural tags.
 */

import sanitizeHtmlLib from "sanitize-html";

/** Tags allowed through sanitization — matches Telegram's supported subset plus safe structural elements. */
const ALLOWED_TAGS = [
  "b",
  "i",
  "u",
  "em",
  "strong",
  "a",
  "code",
  "pre",
  "br",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "span",
  "div",
  "hr",
  "s",
  "strike",
  "del",
  "sub",
  "sup",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const SANITIZE_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: ALLOWED_TAGS,
  // Only href on anchors — no onclick, style, or other attributes
  allowedAttributes: {
    a: ["href"],
  },
  // Restrict link schemes to prevent javascript: or data: URI injection
  allowedSchemes: ["http", "https", "mailto"],
  // Discard disallowed tags entirely rather than escaping them
  disallowedTagsMode: "discard",
};

/**
 * Strips unsafe HTML tags and attributes from agent output.
 *
 * Used by the Telegram adapter before sending messages in HTML parse mode.
 * Retains formatting tags (bold, italic, code, links) while removing
 * everything else to prevent markup injection or parser breakage.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, SANITIZE_OPTIONS);
}
