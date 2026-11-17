import React from 'react';
import { Search, Folder } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import TagFilterDropdown from '@/components/database/TagFilterDropdown';
import CostFilterDropdown from '@/components/database/CostFilterDropdown';

// tags: [{ name, color, icon }] for the active tab
export default function DatabaseToolbar({
  tabs,
  activeTab,
  onTabChange,
  tags,
  selectedTags,
  onTagsChange,
  selectedCosts,
  onCostsChange,
  search,
  onSearchChange,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pb-3">
      <Select value={activeTab || ''} onValueChange={onTabChange}>
        <SelectTrigger className="w-[180px] h-9 flex-shrink-0">
          <Folder size={14} className="mr-2" />
          <SelectValue placeholder="Select tab" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All tabs</SelectItem>
          {tabs.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <TagFilterDropdown tags={tags} selectedTags={selectedTags} onTagsChange={onTagsChange} />
      <CostFilterDropdown selectedCosts={selectedCosts} onCostsChange={onCostsChange} />

      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search cards…"
          className="h-9 pl-8 bg-muted/30 border-border"
        />
      </div>
    </div>
  );
}