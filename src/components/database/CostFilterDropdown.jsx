import React from 'react';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

const COST_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 10 represents "10+"

export default function CostFilterDropdown({ selectedCosts, onCostsChange, align = 'start' }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 flex-shrink-0">
          <Coins size={14} className="mr-2" />
          Cost
          {selectedCosts.length > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 leading-none">
              {selectedCosts.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-40" align={align}>
        <DropdownMenuLabel>Filter by cost</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COST_OPTIONS.map((c) => (
          <DropdownMenuCheckboxItem
            key={c}
            checked={selectedCosts.includes(c)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(checked) => {
              if (checked) onCostsChange([...selectedCosts, c]);
              else onCostsChange(selectedCosts.filter((x) => x !== c));
            }}
          >
            {c === 10 ? '10+' : c}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}