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

interface TeamOwnershipTransferDialogProps {
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function TeamOwnershipTransferDialog({
  member,
  onOpenChange,
  onConfirm,
}: TeamOwnershipTransferDialogProps) {
  return (
    <AlertDialog open={!!member} onOpenChange={(open) => !open && onOpenChange(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">Transfer ownership</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Are you sure you want to transfer ownership to{" "}
            <span className="font-medium text-foreground">{member?.name}</span>? You will be
            downgraded to Admin. This action requires careful consideration.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
          <AlertDialogAction className="text-xs h-8" onClick={onConfirm}>
            Transfer Ownership
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
