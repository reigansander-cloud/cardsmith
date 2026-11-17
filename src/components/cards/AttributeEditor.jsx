import React, { useState, useRef, useEffect } from 'react';
import { ATTRIBUTE_ICONS } from '@/lib/cardIcons';
import IconRenderer from './IconRenderer';
import { Trash2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ColorRichTextarea from './ColorRichTextarea';

export default function AttributeEditor({ attributes, onChange }) {
  const addAttribute = () => {
    onChange([...attributes, { iconKey: 'attr_star', customIconUrl: '', name: '', text: '' }]);
  };

  const updateAttr = (idx, fields, value) => {
    const updated = [...attributes];
    if (typeof fields === 'object' && !Array.isArray(fields)) {
      // called with a patch object
      updated[idx] = { ...updated[idx], ...fields };
    } else {
      updated[idx] = { ...updated[idx], [fields]: value };
    }
    onChange(updated);
  };

  const removeAttr = (idx) => {
    onChange(attributes.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attributes</span>
        <button
          className="text-xs px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
          onClick={addAttribute}
        >+ Add</button>
      </div>
      {attributes.map((attr, idx) => (
        <AttributeRow key={idx} attr={attr} idx={idx} updateAttr={updateAttr} removeAttr={removeAttr} />
      ))}
    </div>
  );
}

function AttributeRow({ attr, idx, updateAttr, removeAttr }) {
  const [showIconPicker, setShowIconPicker] = useState(false);
  const pickerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!showIconPicker) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowIconPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showIconPicker]);

  const handleUploadIcon = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateAttr(idx, { customIconUrl: file_url, iconKey: '' });
    setShowIconPicker(false);
  };

  return (
    <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-2">
      <div className="relative" ref={pickerRef}>
        <button
          className="w-7 h-7 flex items-center justify-center rounded border border-border hover:border-primary bg-card transition-colors flex-shrink-0"
          onClick={() => setShowIconPicker(!showIconPicker)}
        >
          {attr.customIconUrl ? (
            <img src={attr.customIconUrl} alt="" className="w-4 h-4 object-contain" />
          ) : (
            <IconRenderer iconKey={attr.iconKey || 'attr_star'} size={14} className="text-muted-foreground" />
          )}
        </button>
        {showIconPicker && (
          <div className="absolute z-50 top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-xl p-2 w-44">
            <div className="grid grid-cols-4 gap-1 mb-2">
              {ATTRIBUTE_ICONS.map(icon => (
                <button
                  key={icon.key}
                  className={`w-8 h-8 flex items-center justify-center rounded border transition-colors ${
                    attr.iconKey === icon.key && !attr.customIconUrl ? 'border-primary bg-primary/15' : 'border-transparent hover:border-border'
                  }`}
                  title={icon.label}
                  onClick={() => {
                    updateAttr(idx, { iconKey: icon.key, customIconUrl: '' });
                    setShowIconPicker(false);
                  }}
                >
                  <IconRenderer iconKey={icon.key} size={14} className="text-foreground" />
                </button>
              ))}
            </div>
            <button
              className="w-full flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={10} /> Upload custom
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadIcon} />
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <ColorRichTextarea
          value={attr.name || ''}
          onChange={(e) => updateAttr(idx, 'name', e.target.value)}
          placeholder="Attribute name..."
          rows={1}
          className="min-h-[32px] text-xs font-bold"
        />
        <ColorRichTextarea
          value={attr.text || ''}
          onChange={(e) => updateAttr(idx, 'text', e.target.value)}
          placeholder="Attribute text..."
          rows={2}
          className="min-h-[48px] text-xs"
          showIcons={true}
        />
      </div>
      <button
        className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
        onClick={() => removeAttr(idx)}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}