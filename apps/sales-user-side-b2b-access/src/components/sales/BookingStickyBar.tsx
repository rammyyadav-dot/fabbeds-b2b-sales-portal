import { CalendarCheck, ShoppingCart } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface SelectedRoom {
  name: string;
  qty: number;
  pricePerNight: number;
  nights: number;
}

interface Props {
  selected: SelectedRoom[];
  rooms: number;
  onRequest: () => void;
}

export default function BookingStickyBar({ selected, onRequest }: Props) {
  const totalRooms = selected.reduce((s, r) => s + r.qty, 0);
  const nights = selected[0]?.nights ?? 0;
  const hasDates = nights > 0;
  // qty × rate × nights (or just qty × rate if no dates)
  const totalPrice = selected.reduce((s, r) =>
    s + r.qty * r.pricePerNight * (r.nights > 0 ? r.nights : 1), 0);

  return (
    <AnimatePresence>
      {totalRooms > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-2xl border-t border-primary/20"
        >
          <div className="container mx-auto px-4 max-w-7xl py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 opacity-80 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {totalRooms} room{totalRooms !== 1 ? 's' : ''} selected
                </p>
                <div className="text-xs opacity-70 space-y-0.5">
                  {selected.map(r => (
                    <p key={r.name}>
                      {r.qty}× {r.name} · AED {r.pricePerNight.toLocaleString()}/night
                      {hasDates ? ` × ${r.nights}N = AED ${(r.qty * r.pricePerNight * r.nights).toLocaleString()}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs opacity-70">
                  {totalRooms} room{totalRooms !== 1 ? 's' : ''}
                  {hasDates ? ` × ${nights} night${nights !== 1 ? 's' : ''}` : ' · per night'}
                </p>
                <p className="text-xl font-extrabold">AED {totalPrice.toLocaleString()}</p>
              </div>
              <Button
                size="lg"
                variant="secondary"
                className="font-bold gap-2 bg-white text-primary hover:bg-white/90"
                onClick={onRequest}
              >
                <CalendarCheck className="w-4 h-4" />
                I'll reserve
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
