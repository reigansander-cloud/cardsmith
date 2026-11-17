import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, X, ArrowLeft, FileDown } from 'lucide-react';
import { PRINT_SIZES, generatePrintSheetPDF } from '@/lib/printSheet';
import { useToast } from '@/components/ui/use-toast';

export default function PrintDialog({ open, onOpenChange }) {
  const { toast } = useToast();
  const [step, setStep] = useState('size');
  const [sizeKey, setSizeKey] = useState(null);
  const [files, setFiles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef(null);

  const reset = () => { setStep('size'); setSizeKey(null); setFiles([]); };

  const close = () => {
    files.forEach(f => URL.revokeObjectURL(f.url));
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const chooseSize = (key) => { setSizeKey(key); setStep('images'); };

  const handleFiles = (e) => {
    const arr = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    const withUrls = arr.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setFiles(prev => [...prev, ...withUrls]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (i) => {
    URL.revokeObjectURL(files[i].url);
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  };

  const generate = async () => {
    if (files.length === 0) return;
    setGenerating(true);
    try {
      await generatePrintSheetPDF(files.map(f => f.file), sizeKey);
      toast({ title: 'PDF generated' });
      close();
    } catch (err) {
      toast({ title: 'PDF generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'size'
              ? 'Print — choose card size'
              : `Print — ${PRINT_SIZES[sizeKey].label} (${PRINT_SIZES[sizeKey].desc})`}
          </DialogTitle>
        </DialogHeader>

        {step === 'size' ? (
          <div className="grid grid-cols-2 gap-4 py-2">
            {Object.entries(PRINT_SIZES).map(([key, s]) => (
              <button
                key={key}
                className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                onClick={() => chooseSize(key)}
              >
                <div
                  className="bg-muted rounded-md border border-border"
                  style={{ width: key === 'standard' ? 72 : 60, height: key === 'standard' ? 101 : 92 }}
                />
                <div className="text-center">
                  <div className="font-semibold text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep('size')}>
                <ArrowLeft size={14} className="mr-1" /> Change size
              </Button>
              <span className="text-xs text-muted-foreground">{files.length} image(s) · 9 per page</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <Upload size={14} className="mr-2" /> Upload images
              </Button>
              <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
            </div>
            {files.length > 0 ? (
              <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="relative group">
                    <img src={f.url} alt={f.file.name} className="w-full aspect-[2/3] object-cover rounded border border-border" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">Upload card images to arrange 9 per page.</p>
            )}
            <Button className="w-full" onClick={generate} disabled={generating || files.length === 0}>
              <FileDown size={14} className="mr-2" /> {generating ? 'Generating...' : 'Generate PDF'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}