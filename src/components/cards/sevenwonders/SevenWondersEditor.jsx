import React, { useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CardColorPicker from './CardColorPicker';
import CostIconsEditor from './CostIconsEditor';
import AbilityIconEditor from './AbilityIconEditor';
import DrawButton from '@/components/DrawButton';

export default function SevenWondersEditor({ data, onChange, onNameChange }) {
  const { baseImageUrl = '', artUrl = '', title = '', costIcons = [], abilityIcons = [], activatedSlash = false } = data || {};
  const artInputRef = useRef(null);

  const update = (fields) => {
    onChange({ ...data, ...fields });
    if (fields.title !== undefined && onNameChange) onNameChange(fields.title);
  };

  const handleArtUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      update({ artUrl: file_url });
    } catch {}
    if (artInputRef.current) artInputRef.current.value = '';
  };

  return (
    <div className="space-y-3 [&>*]:bg-card [&>*]:border [&>*]:border-border [&>*]:rounded-lg [&>*]:p-4">
      {/* Title */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
        <Input
          value={title}
          onChange={(e) => update({ title: e.target.value })}
          placeholder="Card title..."
          className="bg-muted/30 border-border"
        />
        <p className="text-[11px] text-muted-foreground mt-1">Poiret One, 22px, black. Top of card.</p>
      </div>

      {/* Card color (sets base image + cost banner together) */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Card Color</Label>
        <CardColorPicker value={baseImageUrl} onChange={update} />
        <p className="text-[11px] text-muted-foreground mt-1">Sets the matching template and cost banner together.</p>
      </div>

      {/* Ability icons (under title) */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Ability Icons (under title)</Label>
        <AbilityIconEditor
          value={abilityIcons}
          onChange={(a) => update({ abilityIcons: a })}
          activatedSlash={activatedSlash}
          onActivatedSlashChange={(v) => update({ activatedSlash: v })}
        />
      </div>

      {/* Cost icons */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Cost Icons</Label>
        <CostIconsEditor value={costIcons} onChange={(icons) => update({ costIcons: icons })} />
      </div>

      {/* Main artwork */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Main Artwork (bottom portion)</Label>
        <div className="flex items-center gap-2">
          {artUrl && <img src={artUrl} alt="" className="w-12 h-16 object-cover border border-border rounded" />}
          <Button variant="outline" size="sm" onClick={() => artInputRef.current?.click()}>
            <Upload size={14} className="mr-2" /> Upload
          </Button>
          <DrawButton onSave={(url) => update({ artUrl: url })} />
          {artUrl && (
            <Button variant="ghost" size="sm" onClick={() => update({ artUrl: '' })} className="h-8">
              <X size={14} />
            </Button>
          )}
          <input ref={artInputRef} type="file" accept="image/*" className="hidden" onChange={handleArtUpload} />
        </div>
      </div>
    </div>
  );
}