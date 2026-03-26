import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@onehash/ui/button";
import { InputField } from "@onehash/ui/input";
import { Badge } from "@onehash/ui/badge";
import { Icon } from "@onehash/ui/icon";
import type { IconName } from "@onehash/ui/icon";
import { Popover, PopoverContent, PopoverTrigger } from "@onehash/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@onehash/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainPagesLayoutProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  actionLabel?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionIcon?: IconName;
  onSecondaryAction?: (e?: React.MouseEvent) => void;
  filterContent?: ReactNode;
  filterTitle?: string;
  hasActiveFilters?: boolean;
  activeChips?: { label: string; clear: () => void }[];
  onClearAllFilters?: () => void;
  rightActions?: ReactNode;

  children: ReactNode;
}

export const MainPagesLayout = ({
  searchValue,
  onSearchChange,
  actionLabel,
  actionIcon,
  onAction,
  secondaryActionLabel,
  secondaryActionIcon,
  onSecondaryAction,
  filterContent,
  filterTitle,
  hasActiveFilters = false,
  activeChips,
  onClearAllFilters,
  rightActions,
  children,
}: MainPagesLayoutProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:flex-none">
          <Icon
            name="Search"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
          />
          <InputField
            placeholder={t("search")}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-9 md:h-8 pl-8 text-xs md:w-56"
          />
        </div>

        {filterContent &&
          (isMobile ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 shrink-0"
                onClick={() => setFilterOpen(true)}
              >
                <Icon name="Filter" className="h-3.5 w-3.5" />
                {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
              </Button>
              <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-base">{filterTitle ?? t("filters")}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">{filterContent}</div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0">
                  <Icon name="Filter" className="h-3.5 w-3.5" />
                  <span>{t("filters")}</span>
                  {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-foreground" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 max-h-[70vh] overflow-y-auto" align="start">
                {filterContent}
              </PopoverContent>
            </Popover>
          ))}
        <div className="flex-1" />
        {secondaryActionLabel && secondaryActionIcon && onSecondaryAction && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 md:h-8 text-xs gap-1.5 shrink-0"
            onClick={(e) => onSecondaryAction(e)}
          >
            <Icon name={secondaryActionIcon} className="h-3.5 w-3.5" />{" "}
            {!isMobile && secondaryActionLabel}
          </Button>
        )}
        {actionLabel && actionIcon && onAction ? (
          <Button size="sm" className="h-9 md:h-8 text-xs gap-1.5 shrink-0" onClick={onAction}>
            <Icon name={actionIcon} className="h-3.5 w-3.5" /> {actionLabel}
          </Button>
        ) : null}
        {rightActions}
      </div>

      {activeChips && activeChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeChips.map((chip, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="text-[10px] gap-1 pr-1 cursor-pointer hover:bg-muted"
              onClick={chip.clear}
            >
              {chip.label}
              <Icon name="X" className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {onClearAllFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={onClearAllFilters}
            >
              {t("clear_all")}
            </Button>
          )}
        </div>
      )}
      {children}
    </div>
  );
};
