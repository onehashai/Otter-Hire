"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "../lib/utils";
import { Dialog, DialogContent } from "../dialog";
import { InputField } from "../input";

function Command({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <CommandPrimitive
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
}

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

function CommandInput({
  ref,
  className,
  error,
  ...props
}: React.ComponentProps<typeof InputField> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <InputField
        ref={ref}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        error={error}
        {...props}
      />
    </div>
  );
}
CommandInput.displayName = "CommandInput";

function CommandList({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <CommandPrimitive.List
      ref={ref}
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  );
}
CommandList.displayName = CommandPrimitive.List.displayName;

function CommandEmpty({
  ref,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty> & { ref?: React.Ref<HTMLDivElement> }) {
  return <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />;
}
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

function CommandGroup({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      className={cn(
        "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
CommandGroup.displayName = CommandPrimitive.Group.displayName;

function CommandSeparator({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <CommandPrimitive.Separator ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />
  );
}
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

function CommandItem({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
