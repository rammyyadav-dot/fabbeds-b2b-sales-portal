import { Badge } from '@project/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  'Not Entered': { label: 'Not Entered', className: 'bg-muted text-muted-foreground' },
  'In Country': { label: 'In Country', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  'Extension Pending': { label: 'Extension Pending', className: 'bg-orange-500/15 text-orange-700 border-orange-500/30' },
  'Extended': { label: 'Extended', className: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
  'Overstay': { label: 'OVERSTAY', className: 'bg-destructive/15 text-destructive border-destructive/30 font-bold animate-pulse' },
  'Departed': { label: 'Departed', className: 'bg-muted text-muted-foreground' },
};

export default function StayStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig['Not Entered'];
  return (
    <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}
