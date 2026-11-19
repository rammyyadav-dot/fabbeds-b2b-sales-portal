import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@project/components/ui/sonner';
import { PartnerAuthProvider } from '@/lib/partnerAuth';
import HomePage from './pages/HomePage';
import SalesPortalWrapper from './pages/SalesPortalWrapper';
import HotelProfileWrapper from './pages/HotelProfileWrapper';
import BookingCheckoutWrapper from './pages/BookingCheckoutWrapper';
import MultiRoomCheckoutWrapper from './pages/MultiRoomCheckoutWrapper';
import PriceMatchWrapper from './pages/PriceMatchWrapper';
import OfflineInquiryWrapper from './pages/OfflineInquiryWrapper';
import GroupInquiryPage from './pages/GroupInquiryPage';
import AttractionsPage from './pages/AttractionsPage';
import AttractionDetailPage from './pages/AttractionDetailPage';
import AttractionCheckoutPage from './pages/AttractionCheckoutPage';
import AttractionConfirmationPage from './pages/AttractionConfirmationPage';
import TransfersPage from './pages/TransfersPage';
import VisaPage from './pages/VisaPage';
import PackagesPage from './pages/PackagesPage';
import PackageDetailPage from './pages/PackageDetailPage';
import MyBookingsPage from './pages/MyBookingsPage';
import FindBookingPage from './pages/FindBookingPage';
import PartnerRegisterPage from './pages/PartnerRegisterPage';
import PartnerSignInPage from './pages/PartnerSignInPage';
import PartnerAccountPage from './pages/PartnerAccountPage';
import HotelBookingConfirmationPage from './pages/HotelBookingConfirmationPage';
import WhatsAppWidget from '@/components/WhatsAppWidget';

const noop = () => {};

export default function App() {
  return (
    <BrowserRouter>
      <PartnerAuthProvider>
        <Toaster />
        <WhatsAppWidget />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SalesPortalWrapper />} />
          <Route path="/hotel/:id" element={<HotelProfileWrapper />} />
          <Route path="/hotel/:id/checkout" element={<BookingCheckoutWrapper />} />
          <Route path="/hotel/:id/multi-room-checkout" element={<MultiRoomCheckoutWrapper />} />
          <Route path="/price-match" element={<PriceMatchWrapper />} />
          <Route path="/offline-inquiry" element={<OfflineInquiryWrapper />} />
          <Route path="/group-inquiry" element={<GroupInquiryPage onLogout={noop} />} />
          <Route path="/attractions" element={<AttractionsPage onLogout={noop} />} />
          <Route path="/attraction/:id" element={<AttractionDetailPage onLogout={noop} />} />
          <Route path="/attraction/:id/checkout" element={<AttractionCheckoutPage onLogout={noop} />} />
          <Route path="/attraction/booking/:bookingId/confirmation" element={<AttractionConfirmationPage onLogout={noop} />} />
          <Route path="/attraction/confirmation" element={<Navigate to="/attractions" replace />} />
          <Route path="/transfers" element={<TransfersPage onLogout={noop} />} />
          <Route path="/visa" element={<VisaPage onLogout={noop} />} />
          <Route path="/packages" element={<PackagesPage onLogout={noop} />} />
          <Route path="/package/:id" element={<PackageDetailPage onLogout={noop} />} />
          {/* Partner routes */}
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/find-booking" element={<FindBookingPage />} />
          <Route path="/partner/register" element={<PartnerRegisterPage />} />
          <Route path="/partner/sign-in" element={<PartnerSignInPage />} />
          <Route path="/partner/account" element={<PartnerAccountPage />} />
          <Route path="/booking/:bookingId/confirmation" element={<HotelBookingConfirmationPage />} />
          {/* Legacy redirects */}
          <Route path="/B2BHotelTariff" element={<Navigate to="/" replace />} />
          <Route path="/B2BHotelTariff/*" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PartnerAuthProvider>
    </BrowserRouter>
  );
}
