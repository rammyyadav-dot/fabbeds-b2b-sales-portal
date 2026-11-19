import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FABBEDS } from '../lib/brand';
import BrandWordmark from './BrandWordmark';

const PHONE = '919172712982';
const WHATSAPP_URL = `https://wa.me/${PHONE}`;

const quickReplies = [
  { icon: '🏨', label: 'Hotel Rates' },
  { icon: '🎫', label: 'Visa Services' },
  { icon: '🎢', label: 'Attractions' },
  { icon: '🚗', label: 'Transfers' },
];

export default function WhatsAppWidget() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [popupEl, setPopupEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open || !popupEl) return;
    const handler = (e: MouseEvent) => {
      if (!popupEl.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, popupEl]);

  const popupRefCb = useCallback((node: HTMLDivElement | null) => setPopupEl(node), []);

  const sendMessage = (text?: string) => {
    const url = text ? `${WHATSAPP_URL}?text=${encodeURIComponent(text)}` : WHATSAPP_URL;
    window.open(url, '_blank');
  };

  if (!visible) return null;

  return (
    <>
      {/* Minimal FAB — bottom-left, small */}
      <motion.button
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 left-5 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{ background: '#25d366' }}
        whileTap={{ scale: 0.9 }}
        aria-label="Chat on WhatsApp"
      >
        {open ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        )}
      </motion.button>

      {/* Chat popup — anchored to left side */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popupRefCb}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 left-5 z-50 w-[320px] max-w-[calc(100vw-40px)] rounded-2xl shadow-2xl overflow-hidden border border-border"
          >
            {/* Header */}
            <div className="relative px-4 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #075e54, #128c7e)' }}>
              <div className="min-w-[76px] h-10 rounded-full bg-white flex items-center justify-center shrink-0 px-2.5">
                <BrandWordmark tone="dark" size="sm" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm leading-tight">{FABBEDS.name}</p>
                <p className="text-white/70 text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Replies within minutes
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Chat body */}
            <div className="p-3" style={{ background: '#ece5dd' }}>
              <div className="bg-white rounded-xl rounded-tl-sm p-3 shadow-sm max-w-[90%]">
                <p className="text-sm text-gray-800 leading-relaxed">
                  👋 Hi! Need <strong>hotel rates, visas, attractions</strong> or <strong>transfers</strong>?
                </p>
                <p className="text-[10px] text-gray-400 text-right mt-1">Just now ✓✓</p>
              </div>
            </div>

            {/* Quick replies */}
            <div className="bg-white px-3 py-2.5 flex flex-wrap gap-1.5 border-t border-gray-100">
              {quickReplies.map(qr => (
                <button key={qr.label} onClick={() => sendMessage(`Hi, I'm interested in ${qr.label}`)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50/50 text-emerald-800 text-[11px] font-medium hover:bg-emerald-100 transition-colors">
                  <span>{qr.icon}</span> {qr.label}
                </button>
              ))}
            </div>

            {/* CTA */}
            <div className="bg-white px-3 pb-3">
              <button onClick={() => sendMessage()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Chat on WhatsApp
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
