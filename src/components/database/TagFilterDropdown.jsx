import React from 'react';
import { Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';

// tags: [{ name, color, icon }]
export default function TagFilterDropdown({ tags, selectedTags, onTagsChange, align = 'start' }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 flex-shrink-0">
          <TagIcon size={14} className="mr-2" />
          Tags
          {selectedTags.length > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 leading-none">
              {selectedTags.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align={align}>
        <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">No tags in this tab.</p>
        ) : (
          tags.map((t) => (
            <DropdownMenuCheckboxItem
              key={t.name}
              checked={selectedTags.includes(t.name)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={(checked) => {
                if (checked) onTagsChange([...selectedTags, t.name]);
                else onTagsChange(selectedTags.filter((x) => x !== t.name));
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {t.icon ? (
                  <img src={t.icon} alt="" className="w-3 h-3 rounded-full object-cover" />
                ) : (
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color || '#6b7280' }} />
                )}
                {t.name}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}