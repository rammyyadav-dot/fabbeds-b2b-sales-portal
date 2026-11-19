import { useEffect, useState } from 'react';
import { Mail, Phone, MessageCircle, Headphones } from 'lucide-react';
import { getSupportSettings, type GetSupportSettingsOutputType } from 'zitejs/api';
import { FABBEDS } from '../../lib/brand';

export default function SupportHelpCard({
  bookingReference,
  compact = false,
}: {
  bookingReference?: string;
  compact?: boolean;
}) {
  const [support, setSupport] = useState<GetSupportSettingsOutputType | null>(null);

  useEffect(() => {
    getSupportSettings({}).then(setSupport).catch(() => setSupport({
      bookingEmail: 'book@fbeds.com',
      customerCareNumber: undefined,
      whatsAppNumber: undefined,
      supportHours: undefined,
      emergencyNumber: undefined,
    }));
  }, []);

  const email = support?.bookingEmail || 'book@fbeds.com';

  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Headphones className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm">Need help with this booking?</p>
          <p className="text-xs text-muted-foreground mt-0.5">{FABBEDS.name} Attractions Support</p>

          <div className="mt-3 space-y-2 text-xs">
            <a href={`mailto:${email}`} className="flex items-center gap-2 text-primary hover:underline">
              <Mail className="w-3.5 h-3.5" />
              {email}
            </a>

            {support?.customerCareNumber ? (
              <a href={`tel:${support.customerCareNumber}`} className="flex items-center gap-2 text-foreground hover:text-primary">
                <Phone className="w-3.5 h-3.5" />
                Customer Care: {support.customerCareNumber}
              </a>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                Customer Care number: configure in Admin Support Settings
              </div>
            )}

            {support?.whatsAppNumber && (
              <a href={`https://wa.me/${support.whatsAppNumber.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-foreground hover:text-primary">
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp: {support.whatsAppNumber}
              </a>
            )}

            {bookingReference && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Quote booking reference <strong className="font-mono text-foreground">{bookingReference}</strong> when contacting support.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
