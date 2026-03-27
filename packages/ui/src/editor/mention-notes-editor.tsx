"use client";

import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Mention from "@tiptap/extension-mention";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Text from "@tiptap/extension-text";
import { ReactRenderer, EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Button } from "../button";
import { cn } from "../lib/utils";

export interface NotesMentionableUser {
  id: string;
  name: string | null;
  email: string;
  status: string;
}

export interface MentionNotesEditorProps {
  mentionableUsers: NotesMentionableUser[];
  /** Current user id — excluded from @ suggestions. */
  excludeUserId?: string | null;
  onAddNote?: (content: string, mentions: string[]) => Promise<void>;
  placeholder?: string;
  submitLabel?: string;
}

type MentionItem = {
  id: string;
  label: string;
  email: string;
};

export type MentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

const MentionList = forwardRef<
  MentionListRef,
  {
    items: MentionItem[];
    command: (item: MentionItem) => void;
  }
>(function MentionList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((i) => (items.length ? (i + 1) % items.length : 0));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((i) =>
          items.length ? (i - 1 + items.length) % items.length : 0,
        );
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = items[selectedIndex];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (!items.length) return null;

  return (
    <div className="max-h-[min(40vh,16rem)] overflow-y-auto rounded-md border bg-background py-1 shadow-md">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-muted",
            index === selectedIndex && "bg-muted",
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
        >
          <span className="font-medium">{item.label}</span>
          <span className="truncate text-[10px] text-muted-foreground">{item.email}</span>
        </button>
      ))}
    </div>
  );
});

function positionSuggestion(el: HTMLElement, props: SuggestionProps<MentionItem>) {
  const rect = props.clientRect?.();
  if (!rect) return;
  el.style.position = "fixed";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom + 4}px`;
  el.style.width = `${Math.max(rect.width, 200)}px`;
  el.style.zIndex = "50";
}

function serializeNote(editor: Editor): string {
  const lines: string[] = [];
  editor.state.doc.forEach((block) => {
    if (block.type.name !== "paragraph") return;
    const parts: string[] = [];
    block.forEach((child) => {
      if (child.type.name === "mention") {
        const label = (child.attrs.label as string | null) ?? child.attrs.id;
        parts.push(`@${label}`);
      } else if (child.isText) {
        parts.push(child.text);
      }
    });
    lines.push(parts.join(""));
  });
  return lines.join("\n").trim();
}

function collectMentionIds(editor: Editor): string[] {
  const ids: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "mention" && node.attrs.id) {
      ids.push(node.attrs.id as string);
    }
  });
  return [...new Set(ids)];
}

export function MentionNotesEditor({
  mentionableUsers,
  excludeUserId,
  onAddNote,
  placeholder = "Add a note... Use @ to tag a teammate",
  submitLabel = "Add Note",
}: MentionNotesEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [tick, setTick] = useState(0);

  const mentionableForTags = useMemo(
    () =>
      excludeUserId
        ? mentionableUsers.filter((u) => u.id !== excludeUserId)
        : mentionableUsers,
    [mentionableUsers, excludeUserId],
  );

  const labelByUserId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of mentionableForTags) {
      const baseLabel = (user.name || user.email).trim();
      counts.set(baseLabel.toLowerCase(), (counts.get(baseLabel.toLowerCase()) ?? 0) + 1);
    }

    return new Map(
      mentionableForTags.map((user) => {
        const baseLabel = (user.name || user.email).trim();
        const label = (counts.get(baseLabel.toLowerCase()) ?? 0) > 1 ? user.email : baseLabel;
        return [user.id, label] as const;
      }),
    );
  }, [mentionableForTags]);

  const activeMembers = useMemo(
    () => mentionableForTags.filter((user) => user.status === "active"),
    [mentionableForTags],
  );

  const labelRef = useRef(labelByUserId);
  const activeRef = useRef(activeMembers);
  labelRef.current = labelByUserId;
  activeRef.current = activeMembers;

  const extensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      HardBreak,
      Placeholder.configure({ placeholder }),
      Mention.configure({
        HTMLAttributes: {
          class: "font-semibold text-foreground",
        },
        suggestion: {
          char: "@",
          allowSpaces: true,
          items: ({ query }) => {
            const q = query.trim().toLowerCase();
            const members = activeRef.current;
            const labels = labelRef.current;
            let list = members;
            if (q) {
              list = members.filter((user) => {
                const label = (labels.get(user.id) || user.email).toLowerCase();
                return (
                  label.includes(q) ||
                  user.email.toLowerCase().includes(q) ||
                  (user.name || "").toLowerCase().includes(q)
                );
              });
            }
            return list.slice(0, 6).map(
              (user): MentionItem => ({
                id: user.id,
                label: labels.get(user.id) || user.email,
                email: user.email,
              }),
            );
          },
          render: () => {
            let component: ReactRenderer | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(MentionList, {
                  editor: props.editor,
                  props: {
                    items: props.items,
                    command: (item: MentionItem) => {
                      props.command({ id: item.id, label: item.label });
                    },
                  },
                });
                component.element.style.margin = "0";
                document.body.appendChild(component.element);
                positionSuggestion(component.element, props);
              },
              onUpdate: (props) => {
                component?.updateProps({
                  items: props.items,
                  command: (item: MentionItem) => {
                    props.command({ id: item.id, label: item.label });
                  },
                });
                if (component) positionSuggestion(component.element, props);
              },
              onKeyDown: (keyProps) => {
                if (keyProps.event.key === "Escape") {
                  return true;
                }
                const listRef = component?.ref as MentionListRef | null | undefined;
                return listRef?.onKeyDown(keyProps) ?? false;
              },
              onExit: () => {
                component?.destroy();
                component = null;
              },
            };
          },
        },
      }),
    ],
    [placeholder],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      editorProps: {
        attributes: {
          class:
            "min-h-[60px] w-full resize-none px-3 py-2 text-xs leading-normal text-foreground outline-none focus:outline-none",
        },
      },
      onUpdate: () => setTick((n) => n + 1),
    },
    [extensions],
  );

  const canSubmit =
    !!onAddNote && editor && serializeNote(editor).trim().length > 0;

  const handleSubmit = async () => {
    if (!editor || !onAddNote || !canSubmit) return;
    const content = serializeNote(editor);
    if (!content.trim()) return;
    try {
      setSubmitting(true);
      await onAddNote(content, collectMentionIds(editor));
      editor.commands.clearContent();
    } finally {
      setSubmitting(false);
    }
  };

  if (!editor) return null;

  void tick;

  return (
    <div className="relative shrink-0 space-y-3">
      <div
        className={cn(
          "rounded-md border border-input bg-background transition-colors focus-within:border-muted-foreground",
          submitting && "pointer-events-none opacity-60",
        )}
      >
        <EditorContent editor={editor} />
      </div>
      <Button
        size="sm"
        className="h-7 text-xs"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
