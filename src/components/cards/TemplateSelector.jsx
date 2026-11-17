import React, { useState, useEffect } from 'react';
import { getTemplateList } from '@/lib/cardTemplates';
import { getTemplates } from '@/lib/freeCanvasTemplates';
import { Layers, Frame, ChevronLeft, Image as ImageIcon, Landmark, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const TEMPLATE_ICONS = {
  glimpses: Frame,
  free_canvas: ImageIcon,
  seven_wonders: Landmark,
};

function TemplateCard({ template, onSelect }) {
  const Icon = TEMPLATE_ICONS[template.key] || Layers;
  return (
    <button
      className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200"
      onClick={() => onSelect(template.key)}
    >
      <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Icon size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="font-semibold text-foreground text-sm text-center">{template.label}</div>
    </button>
  );
}

export default function TemplateSelector({ onSelect }) {
  const templates = getTemplateList();
  const [openFolder, setOpenFolder] = useState(null);
  const [fcTemplates, setFcTemplates] = useState([]);

  useEffect(() => {
    setFcTemplates(getTemplates());
  }, []);

  const freeCanvas = templates.find(t => t.key === 'free_canvas');
  const standalone = templates.filter(t => !t.folder && t.key !== 'free_canvas');
  const folders = {};
  templates.filter(t => t.folder).forEach(t => {
    if (!folders[t.folder]) folders[t.folder] = [];
    folders[t.folder].push(t);
  });

  if (openFolder) {
    const folderTemplates = folders[openFolder] || [];
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold font-heading text-foreground mb-2">{openFolder}</h2>
          <p className="text-sm text-muted-foreground">Choose a template type</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl w-full">
          {folderTemplates.map(t => (
            <TemplateCard key={t.key} template={t} onSelect={onSelect} />
          ))}
        </div>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          onClick={() => setOpenFolder(null)}
        >
          <ChevronLeft size={16} /> Back to templates
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 py-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold font-heading text-foreground mb-2">Choose a Template</h2>
        <p className="text-sm text-muted-foreground">Select a card type to begin designing</p>
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-4">
        {freeCanvas && (
          <button
            className="group flex items-center gap-4 w-full px-6 py-4 rounded-lg border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200"
            onClick={() => onSelect(freeCanvas.key)}
          >
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <ImageIcon size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-foreground text-lg">{freeCanvas.label}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{freeCanvas.description}</div>
            </div>
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
          <Link to="/clans" className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Users size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="font-semibold text-foreground text-sm text-center">Clans</div>
          </Link>
          {standalone.map(t => (
            <TemplateCard key={t.key} template={t} onSelect={onSelect} />
          ))}
          {fcTemplates.map(t => (
            <button
              key={t.name}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200"
              onClick={() => onSelect(`free_canvas_template:${t.name}`)}
            >
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <ImageIcon size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="font-semibold text-foreground text-sm text-center truncate w-full">{t.name}</div>
            </button>
          ))}
          {Object.entries(folders).map(([folderName, folderTemplates]) => (
            <button
              key={folderName}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-card hover:border-primary hover:bg-primary/5 transition-all duration-200"
              onClick={() => setOpenFolder(folderName)}
            >
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Layers size={30} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="font-semibold text-foreground text-sm text-center">{folderName}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}