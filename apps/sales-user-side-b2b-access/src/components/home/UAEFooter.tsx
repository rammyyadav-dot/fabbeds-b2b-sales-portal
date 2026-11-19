import { useNavigate } from 'react-router-dom';
import { UAE_FOOTER_DIRECTORY } from '@/lib/homeContent';
import { FABBEDS } from '../../lib/brand';
import BrandWordmark from '../BrandWordmark';

function routeFor(label: string) {
  const l = label.toLowerCase();
  if (l.includes('sign in')) return '/partner/sign-in';
  if (l.includes('my bookings')) return '/my-bookings';
  if (l.includes('credit')) return '/partner/account';
  if (l.includes('find a booking')) return '/find-booking';
  if (l.includes('price match')) return '/price-match';
  if (l.includes('attraction')) return '/attractions';
  if (l.includes('transfer')) return '/transfers';
  if (l.includes('visa')) return '/visa';
  if (l.includes('package')) return '/packages';
  if (l.includes('groups')) return '/group-inquiry';
  if (l.includes('offline')) return '/offline-inquiry';

  const emirates = ['Dubai','Abu Dhabi','Ras Al Khaimah','Sharjah','Fujairah','Ajman','Umm Al Quwain'];
  const emirate = emirates.find(e => l.includes(e.toLowerCase()));
  return emirate ? '/search?q=' + encodeURIComponent(emirate) : '/search';
}

export default function UAEFooter() {
  const navigate = useNavigate();

  return (
    <footer className="mt-14 border-t border-white/10 bg-[#111111] text-white">
      <div className="container mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {UAE_FOOTER_DIRECTORY.map(group => (
            <div key={group.heading}>
              <h3 className="fb-kicker text-white">{group.heading}</h3>
              <div className="mt-3 space-y-2">
                {group.links.map(link => (
                  <button
                    key={link}
                    onClick={() => navigate(routeFor(link))}
                    className="block text-left text-xs text-white/55 hover:text-white transition-colors"
                  >
                    {link}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-9 pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandWordmark tone="light" size="md" />
            <div>
              <p className="text-xs text-white/45 tracking-[0.12em] uppercase">{FABBEDS.tagline}</p>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
