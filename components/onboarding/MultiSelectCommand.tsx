'use client';

import * as React from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type Item = {
  value: string;
  label: string;
  group?: string;
};

type MultiSelectCommandProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  options: Item[];
  max?: number;
  clearable?: boolean;
  className?: string;
};

export function MultiSelectCommand(props: MultiSelectCommandProps) {
  const {
    value,
    onChange,
    placeholder = 'Search…',
    emptyText = 'No results',
    options,
    max = Number.POSITIVE_INFINITY,
    clearable = true,
    className,
  } = props;

  const [open, setOpen] = React.useState(false);
  const isAtLimit = value.length >= max;

  function toggle(option: Item) {
    const isSelected = value.includes(option.value);
    if (isSelected) {
      onChange(value.filter((v) => v !== option.value));
      return;
    }
    if (isAtLimit) {
      toast.dismiss();
      toast('Selection limit reached', {
        description: `You can select up to ${max}.`,
      });
      return;
    }
    onChange([...value, option.value]);
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const byGroup = React.useMemo(() => {
    const map = new Map<string | undefined, Item[]>();
    for (const opt of options) {
      const key = opt.group;
      const list = map.get(key) ?? [];
      list.push(opt);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [options]);

  const TriggerContent = (
    <div className="flex min-h-9 w-full flex-wrap items-center gap-1 text-left">
      {value.length === 0 ? (
        <span className="text-muted-foreground text-sm">{placeholder}</span>
      ) : (
        <div className="flex w-full items-center gap-2 overflow-hidden">
          <div className="flex flex-1 flex-wrap gap-1 overflow-hidden">
            {value.slice(0, 3).map((v) => (
              <Badge
                key={v}
                variant="secondary"
                className="max-w-[160px] truncate border border-primary/30 bg-primary/15 text-primary"
              >
                {options.find((o) => o.value === v)?.label ?? v}
              </Badge>
            ))}
            {value.length > 3 && (
              <Badge variant="outline">+{value.length - 3}</Badge>
            )}
          </div>
          {clearable && value.length > 0 && (
            <span
              role="button"
              aria-label="Clear selection"
              onClick={clearAll}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </div>
      )}
    </div>
  );

  const ListContent = (
    <div className="flex h-full flex-col">
      <div className="px-1 pt-1">
        <CommandInput placeholder={placeholder} />
      </div>
      <CommandList className="relative">
        <CommandEmpty>{emptyText}</CommandEmpty>
        <ScrollArea className="max-h-72">
          {byGroup.map(([group, items], idx) => (
            <React.Fragment key={group ?? idx}>
              <CommandGroup heading={group}>
                {items.map((opt) => {
                  const selected = value.includes(opt.value);
                  return (
                    <CommandItem
                      key={opt.value}
                      onSelect={() => toggle(opt)}
                      disabled={!selected && isAtLimit}
                      className={cn(selected && 'bg-primary/10 text-primary')}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                          selected && 'border-primary bg-primary/15',
                        )}
                      >
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </div>
                      {opt.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {idx !== byGroup.length - 1 && <CommandSeparator />}
            </React.Fragment>
          ))}
        </ScrollArea>
      </CommandList>
      <Separator />
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Progress
            value={(value.length / Math.max(max, 1)) * 100}
            className="h-1 w-24"
          />
          <span>
            {value.length} / {max}
          </span>
        </div>
        {clearable && value.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear all
          </Button>
        )}
      </div>
    </div>
  );

  // Desktop: Popover; Mobile: Drawer
  return (
    <TooltipProvider>
      <div className={cn('w-full', className)}>
        <div className="hidden sm:block">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>
              <div
                role="combobox"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'w-full justify-between',
                )}
              >
                {TriggerContent}
              </div>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[min(640px,90vw)]">
              <Command>{ListContent}</Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="block sm:hidden">
          <Drawer>
            <DrawerTrigger>
              <div
                role="combobox"
                className={cn(
                  buttonVariants({ variant: 'outline' }),
                  'w-full justify-between',
                )}
              >
                {TriggerContent}
              </div>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Select</DrawerTitle>
              </DrawerHeader>
              <div className="px-2 pb-3">
                <Command className="rounded-lg border">{ListContent}</Command>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    </TooltipProvider>
  );
}

export function toItems(
  values: readonly string[],
  groups?: Record<string, ReadonlyArray<string>>,
): Item[] {
  if (!groups) return values.map((v) => ({ value: v, label: v }));
  const groupOf: Record<string, string> = {};
  for (const [group, list] of Object.entries(groups)) {
    for (const v of list) groupOf[v] = group;
  }
  return values.map((v) => ({ value: v, label: v, group: groupOf[v] }));
}
