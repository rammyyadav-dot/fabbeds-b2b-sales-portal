type AvailabilityStatus = 'Available' | 'Limited' | 'On Request' | 'Sold Out';

const CONFIG: Record<AvailabilityStatus, { dot: string; text: string; bg: string }> = {
  Available: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  Limited: { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  'On Request': { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  'Sold Out': { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-50 border-gray-200' },
};

interface AvailabilityBadgeProps {
  status?: AvailabilityStatus;
}

export default function AvailabilityBadge({ status = 'Available' }: AvailabilityBadgeProps) {
  const c = CONFIG[status] ?? CONFIG['Available'];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'Available' ? 'animate-pulse' : ''} ${c.dot}`} />
      {status}
    </span>
  );
}
