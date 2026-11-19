import { Button } from '@project/components/ui/button';
import { Paintbrush, Undo2, RotateCcw, Save, X } from 'lucide-react';

export type PaintStatus = 'Free Sale' | 'Stop Sale' | 'On Request' | 'Limited' | null;

interface Props {
  paintMode: PaintStatus;
  onPaintMode: (m: PaintStatus) => void;
  onUndo: () => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}

const MODES: { status: PaintStatus; label: string; icon: string; cls: string }[] = [
  { status: 'Free Sale', label: 'Free Sale', icon: '✓', cls: 'bg-green-500 hover:bg-green-600 text-white' },
  { status: 'Stop Sale', label: 'Stop Sale', icon: '✕', cls: 'bg-red-500 hover:bg-red-600 text-white' },
  { status: 'On Request', label: 'On Request', icon: '?', cls: 'bg-yellow-400 hover:bg-yellow-500 text-white' },
  { status: 'Limited', label: 'Limited', icon: '!', cls: 'bg-orange-500 hover:bg-orange-600 text-white' },
];

export default function AvailabilityPaintToolbar({ paintMode, onPaintMode, onUndo, onReset, onSave, saving, hasChanges }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Paintbrush className="w-4 h-4 text-purple-500" />
            Paint Mode:
          </div>
          {MODES.map(m => (
            <button
              key={m.status}
              onClick={() => onPaintMode(paintMode === m.status ? null : m.status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 border-2 transition-all ${m.cls} ${paintMode === m.status ? 'ring-2 ring-offset-1 ring-purple-500 border-purple-500' : 'border-transparent'}`}
            >
              <span className="font-bold">{m.icon}</span> {m.label}
            </button>
          ))}
          <button
            onClick={() => onPaintMode(null)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 border border-border bg-background hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear Paint Mode
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onUndo} className="gap-1.5"><Undo2 className="w-3.5 h-3.5" /> Undo</Button>
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5"><RotateCcw className="w-3.5 h-3.5" /> Reset All</Button>
          <Button size="sm" onClick={onSave} disabled={saving || !hasChanges} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {paintMode && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm flex items-center gap-2">
          <span className="text-purple-600 font-medium">ⓘ Active:</span>
          <span className="text-muted-foreground">Click and drag across dates to paint with</span>
          {MODES.find(m => m.status === paintMode) && (
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${MODES.find(m => m.status === paintMode)!.cls}`}>
              {paintMode}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
