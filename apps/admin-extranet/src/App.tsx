import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, loginWithRedirect } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import Layout from '@/components/Layout';
import PartnerLayout from '@/components/PartnerLayout';
import LoginPage from '@/pages/LoginPage';
import PartnerLoginPage from '@/pages/PartnerLoginPage';
import PartnerHotelPage from '@/pages/PartnerHotelPage';
import PortalSelectPage from '@/pages/PortalSelectPage';
import RoleGuard from '@/components/RoleGuard';
import DashboardPage from '@/pages/DashboardPage';
import HotelsPage from '@/pages/HotelsPage';
import HotelDetailPage from '@/pages/HotelDetailPage';
import MarkupRulesPage from '@/pages/MarkupRulesPage';
import QuickUpdatePage from '@/pages/QuickUpdatePage';
import RateSheetPage from '@/pages/RateSheetPage';
import BookingPage from '@/pages/BookingPage';
import BookingsAdminPage from '@/pages/BookingsAdminPage';
import FinancialReportsPage from '@/pages/FinancialReportsPage';
import ManageBookingPage from '@/pages/ManageBookingPage';
import GroupMICEPage from '@/pages/GroupMICEPage';
import GroupLeadDetailPage from '@/pages/GroupLeadDetailPage';
import ReservationsPage from '@/pages/ReservationsPage';
import ReservationDetailPage from '@/pages/ReservationDetailPage';
import RateSyncPage from '@/pages/RateSyncPage';
import RateUploadPage from '@/pages/RateUploadPage';
import PromotionFormPage from '@/pages/PromotionFormPage';
import UserManagementPage from '@/pages/UserManagementPage';
import PricingEnginePage from '@/pages/PricingEnginePage';
import SourceMarketsPage from '@/pages/SourceMarketsPage';
import BookingCertificationDashboardPage from '@/pages/BookingCertificationDashboardPage';
import HomepageBannersPage from '@/pages/HomepageBannersPage';
import AttractionsAdminPage from '@/pages/AttractionsAdminPage';
import VisaAdminPage from '@/pages/VisaAdminPage';
import TransferAdminPage from '@/pages/TransferAdminPage';
import PackageAdminPage from '@/pages/PackageAdminPage';
import { useAppAuth } from '@/hooks/useAppAuth';
import { usePartnerAuth } from '@/hooks/usePartnerAuth';
import { DmcRole } from '@/hooks/useRole';

// ── Guards ────────────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppAuth();
  const { user: ziteUser, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && !ziteUser) loginWithRedirect();
  }, [isLoading, ziteUser]);
  // Staff endpoints verify the real Zite session server-side, so sign-in is required first.
  if (isLoading || !ziteUser) return <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Signing you in…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PartnerAuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = usePartnerAuth();
  if (!user) return <Navigate to="/partner/login" replace />;
  return <>{children}</>;
}

/** Restrict a route to specific DMC roles */
function Only({ roles, children }: { roles: DmcRole[]; children: React.ReactNode }) {
  return <RoleGuard allowedRoles={roles}>{children}</RoleGuard>;
}

// ── Role groups ───────────────────────────────────────────────────────────────
/** Contracting-focused tools (hotels, rates, markup) */
const CONTRACTING: DmcRole[] = ['Admin', 'Contracting Team'];

/** Rate sheet visible to contracting + sales */
const RATE_SHEET: DmcRole[] = ['Admin', 'Contracting Team', 'Sales Manager'];

/** Bookings / reservations open to contracting + sales + reservations */
const BOOKINGS: DmcRole[] = ['Admin', 'Contracting Team', 'Sales Manager', 'Reservations Agent'];

/** MICE / group leads: sales + reservations */
const MICE: DmcRole[] = ['Admin', 'Contracting Team', 'Sales Manager', 'Reservations Agent'];

/** Financial reports: Finance Controller only */
const FINANCE: DmcRole[] = ['Admin', 'Finance Controller'];

// ── App routes (DMC staff) ────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Layout>
      <Routes>
        {/* Dashboard – all authenticated DMC staff */}
        <Route path="/" element={<DashboardPage />} />

        {/* Bookings & Reservations – contracting + sales + reservations */}
        <Route path="/bookings"     element={<Only roles={BOOKINGS}><BookingsAdminPage /></Only>} />
        <Route path="/reservations" element={<Only roles={BOOKINGS}><ReservationsPage /></Only>} />
        <Route path="/reservations/:reservationId" element={<Only roles={BOOKINGS}><ReservationDetailPage /></Only>} />

        {/* MICE / Group Leads – sales + reservations */}
        <Route path="/mice"         element={<Only roles={MICE}><GroupMICEPage /></Only>} />
        <Route path="/mice/:leadId" element={<Only roles={MICE}><GroupLeadDetailPage /></Only>} />

        {/* Redirects */}
        <Route path="/inquiries"     element={<Navigate to="/reservations" replace />} />
        <Route path="/inquiries/:id" element={<Navigate to="/reservations" replace />} />

        {/* Contracting tools */}
        <Route path="/hotels"       element={<Only roles={CONTRACTING}><HotelsPage /></Only>} />
        <Route path="/hotels/:id"   element={<Only roles={CONTRACTING}><HotelDetailPage /></Only>} />
        <Route path="/hotels/:id/promotions/:promoId" element={<Only roles={CONTRACTING}><PromotionFormPage /></Only>} />
        <Route path="/quick-update" element={<Only roles={CONTRACTING}><QuickUpdatePage /></Only>} />
        <Route path="/markup-rules" element={<Only roles={CONTRACTING}><MarkupRulesPage /></Only>} />
        <Route path="/pricing-engine" element={<Only roles={CONTRACTING}><PricingEnginePage /></Only>} />
        <Route path="/source-markets" element={<Only roles={CONTRACTING}><SourceMarketsPage /></Only>} />
        <Route path="/rate-sync"    element={<Only roles={CONTRACTING}><RateSyncPage /></Only>} />
        <Route path="/rate-upload"  element={<Only roles={CONTRACTING}><RateUploadPage /></Only>} />
        <Route path="/booking-certification" element={<Only roles={['Admin']}><BookingCertificationDashboardPage /></Only>} />

        {/* Rate Sheet – contracting + sales */}
        <Route path="/rate-sheet"   element={<Only roles={RATE_SHEET}><RateSheetPage /></Only>} />

        {/* Finance – Finance Controller only */}
        <Route path="/financial-reports" element={<Only roles={FINANCE}><FinancialReportsPage /></Only>} />

        {/* Attractions & Tickets */}
        <Route path="/attractions" element={<Only roles={['Admin','Contracting Team','Sales Manager','Reservations Agent']}><AttractionsAdminPage /></Only>} />

        {/* Visa Operations – Admin controlled workflow */}
        <Route path="/visa" element={<Only roles={['Admin']}><VisaAdminPage /></Only>} />

        {/* Transfer Operations – Admin controlled workflow */}
        <Route path="/transfers" element={<Only roles={['Admin']}><TransferAdminPage /></Only>} />

        {/* UAE Package Operations – Admin controlled workflow */}
        <Route path="/packages" element={<Only roles={['Admin']}><PackageAdminPage /></Only>} />

        {/* Marketing / Homepage */}
        <Route path="/homepage-banners" element={<Only roles={['Admin','Sales Manager','Contracting Team']}><HomepageBannersPage /></Only>} />

        {/* Admin – User Management */}
        <Route path="/user-management" element={<Only roles={['Admin']}><UserManagementPage /></Only>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

// ── Partner routes (Hotel Partners) ──────────────────────────────────────────
function PartnerRoutes() {
  return (
    <PartnerAuthGuard>
      <PartnerLayout>
        <Routes>
          <Route path="/hotel" element={<PartnerHotelPage />} />
          <Route path="*"      element={<Navigate to="/partner/hotel" replace />} />
        </Routes>
      </PartnerLayout>
    </PartnerAuthGuard>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/book"           element={<><BookingPage /><Toaster richColors position="top-right" /></>} />
        <Route path="/manage-booking" element={<><ManageBookingPage /><Toaster richColors position="top-right" /></>} />
        <Route path="/portal"         element={<><PortalSelectPage /><Toaster richColors position="top-right" /></>} />

        {/* DMC Staff login */}
        <Route path="/login"          element={<><LoginPage /><Toaster richColors position="top-right" /></>} />

        {/* Hotel Partner Extranet */}
        <Route path="/partner/login"  element={<><PartnerLoginPage /><Toaster richColors position="top-right" /></>} />
        <Route path="/partner/*"      element={<PartnerRoutes />} />

        {/* DMC TMS (authenticated) */}
        <Route path="/*" element={
          <AuthGuard>
            <AppRoutes />
          </AuthGuard>
        } />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  );
}
