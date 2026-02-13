import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FABProps {
  onClick?: () => void;
}

export function FloatingActionButton({ onClick }: FABProps) {
  return (
    <Button
      size="icon"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg md:hidden"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
