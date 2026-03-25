"use client";

import { useState, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Button } from "../button";

import "./rich-text-editor-code-theme.css";
import { cn } from "../lib/utils";
import { Icon } from "../icon";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ content, onChange, placeholder, className }: RichTextEditorProps) {
  const lowlight = useMemo(() => createLowlight(common), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: "rounded-md bg-muted border border-border font-mono text-sm overflow-x-auto p-3 my-2",
        },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[120px] px-4 py-3 focus:outline-none text-foreground [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-muted-foreground [&_a]:underline [&_pre]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
      },
    },
  });

  // Force re-render when selection or content changes so toolbar active state stays in sync
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", onUpdate);
    editor.on("transaction", onUpdate);
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("transaction", onUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current === content) return;
    editor.commands.setContent(content || "", { emitUpdate: false });
  }, [content, editor]);

  if (!editor) return null;

  const ToolBtn = ({
    active,
    onClick,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", active && "bg-muted")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  const setLink = () => {
    const url = window.prompt("URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={cn("rich-text-editor rounded-md border border-input transition-colors focus-within:border-muted-foreground", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Icon name="Bold" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Icon name="Italic" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <Icon name="Underline" className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Icon name="Heading1" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Icon name="Heading2" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Icon name="Heading3" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <Icon name="List" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <Icon name="ListOrdered" className="h-3.5 w-3.5" />
        </ToolBtn>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolBtn active={editor.isActive("link")} onClick={setLink}>
          <Icon name="Link" className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Icon name="Code" className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>
      <div className="max-h-[min(60vh,32rem)] overflow-y-auto overflow-x-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
