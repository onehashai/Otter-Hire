"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@onehash/ui/alert-dialog";
import type { TeamMember } from "@/components/settings/team/TeamMembersList";

interface TeamMemberRemoveDialogProps {
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TeamMemberRemoveDialog({ member, onOpenChange, onConfirm }: TeamMemberRemoveDialogProps) {
  return (
    <AlertDialog open={!!member} onOpenChange={(open) => !open && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">Remove team member</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Are you sure you want to remove <span className="font-medium text-foreground">{member?.name}</span> from the team? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
          <AlertDialogAction className="text-xs h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
