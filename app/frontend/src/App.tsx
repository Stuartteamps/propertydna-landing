import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import Analyze from "./pages/Analyze";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import HowItWorks from "./pages/HowItWorks";
import SampleReport from "./pages/SampleReport";
import ReportView from "./pages/ReportView";
import ReportViewByToken from "./pages/ReportViewByToken";
import Professionals from "./pages/Professionals";
import MarketHeatMap from "./pages/MarketHeatMap";
import IntellaGraph from "./pages/IntellaGraph";
import OpenHouse from "./pages/OpenHouse";
import SellerValuation from "./pages/SellerValuation";
import BuyerAccess from "./pages/BuyerAccess";
import OffMarket from "./pages/OffMarket";
import Newsletter from "./pages/Newsletter";
import Contact from "./pages/Contact";
import ReportPending from "./pages/ReportPending";
import StripeTest from "./pages/StripeTest";
import Dashboard from "./pages/Dashboard";
import WatchList from "./pages/WatchList";
import Methodology from "./pages/Methodology";
import BuyerProtection from "./pages/BuyerProtection";
import AdminSocialOauth from "./pages/admin/SocialOauth";
import ShareStory from "./pages/ShareStory";
import Accuracy from "./pages/Accuracy";
import PressKit2 from "./pages/PressKit2";
import Partners from "./pages/Partners";
import AuthCallback from "./pages/AuthCallback";
import AuthError from "./pages/AuthError";
import CampaignManager from "./pages/admin/CampaignManager";
import KpiDashboard from "./pages/admin/KpiDashboard";
import Listings from "./pages/Listings";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Privacy from "./pages/Privacy";
import Waitlist from "./pages/Waitlist";
import Dossier from "./pages/Dossier";
import LuxuryInventory from "./pages/LuxuryInventory";
import PedigreeIndex from "./pages/PedigreeIndex";
import OpenHouse697Farrell from "./pages/OpenHouse697Farrell";
import PropertyTicker from "./pages/PropertyTicker";
import Dossiers from "./pages/Dossiers";
import Neighborhood from "./pages/Neighborhood";
import DossierRequestsAdmin from "./pages/admin/DossierRequests";
import OpsDashboard from "./pages/admin/OpsDashboard";
import ArchitectProfile from "./pages/ArchitectProfile";
import ArchitectsIndex from "./pages/ArchitectsIndex";
import PressKit from "./pages/PressKit";
import DossierRequest from "./pages/DossierRequest";
import SavedReports from "./pages/SavedReports";
import NotFound from "./pages/NotFound";
import NativeBottomNav from "@/components/NativeBottomNav";
import OfflineBanner from "@/components/OfflineBanner";
import AppStoreBanner from "@/components/AppStoreBanner";
import Launch from "./pages/Launch";
import IOSLaunchPress from "./pages/IOSLaunchPress";
import CityLanding from "./pages/CityLanding";
import Battlefield from "./pages/Battlefield";

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/home" element={<Index />} />
    <Route path="/analyze" element={<Analyze />} />
    <Route path="/pricing" element={<Pricing />} />
    <Route path="/about" element={<About />} />
    <Route path="/how-it-works" element={<HowItWorks />} />
    <Route path="/sample-report" element={<SampleReport />} />
    <Route path="/report/view/:token" element={<ReportViewByToken />} />
    <Route path="/dossiers" element={<Dossiers />} />
    <Route path="/dossier/:apn" element={<Dossier />} />
    <Route path="/luxury-inventory" element={<LuxuryInventory />} />
    <Route path="/pedigree-index" element={<PedigreeIndex />} />
    <Route path="/open-house/697-n-farrell" element={<OpenHouse697Farrell />} />
    <Route path="/ticker/:apn" element={<PropertyTicker />} />
    <Route path="/neighborhood/:slug" element={<Neighborhood />} />
    <Route path="/admin/dossier-requests" element={<DossierRequestsAdmin />} />
    <Route path="/admin/ops" element={<OpsDashboard />} />
    <Route path="/architect/:slug" element={<ArchitectProfile />} />
    <Route path="/architects" element={<ArchitectsIndex />} />
    <Route path="/press" element={<PressKit />} />
    <Route path="/dossier-request" element={<DossierRequest />} />
    <Route path="/report/:id" element={<ReportView />} />
    <Route path="/professionals" element={<Professionals />} />
    <Route path="/market-heatmaps" element={<MarketHeatMap />} />
    <Route path="/intellagraph"     element={<IntellaGraph />} />
    <Route path="/report" element={<ReportView />} />
    <Route path="/property-dna" element={<Index />} />
    <Route path="/open-house" element={<OpenHouse />} />
    <Route path="/seller-valuation" element={<SellerValuation />} />
    <Route path="/buyer-access" element={<BuyerAccess />} />
    <Route path="/off-market" element={<OffMarket />} />
    <Route path="/newsletter" element={<Newsletter />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/report-pending" element={<ReportPending />} />
    <Route path="/stripe-test"    element={<StripeTest />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/watch" element={<WatchList />} />
    <Route path="/watchlist" element={<WatchList />} />
    <Route path="/methodology" element={<Methodology />} />
    <Route path="/how" element={<Methodology />} />
    <Route path="/buyer-protection" element={<BuyerProtection />} />
    <Route path="/letter" element={<BuyerProtection />} />
    <Route path="/admin/oauth" element={<AdminSocialOauth />} />
    <Route path="/admin/social" element={<AdminSocialOauth />} />
    <Route path="/share-your-story" element={<ShareStory />} />
    <Route path="/share-story" element={<ShareStory />} />
    <Route path="/accuracy" element={<Accuracy />} />
    <Route path="/press-kit" element={<PressKit2 />} />
    <Route path="/press" element={<PressKit2 />} />
    <Route path="/partners" element={<Partners />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/auth/error" element={<AuthError />} />
    <Route path="/listings/:region" element={<Listings />} />
    <Route path="/listings" element={<Listings />} />
    <Route path="/outreach" element={<CampaignManager />} />
    <Route path="/admin/campaigns" element={<CampaignManager />} />
    <Route path="/admin/kpis" element={<KpiDashboard />} />
    <Route path="/blog/:slug" element={<BlogPost />} />
    <Route path="/blog" element={<Blog />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/waitlist" element={<Waitlist />} />
    <Route path="/saved-reports" element={<SavedReports />} />
    <Route path="/launch" element={<Launch />} />
    <Route path="/ios" element={<Launch />} />
    <Route path="/app" element={<Launch />} />
    <Route path="/press/ios-launch" element={<IOSLaunchPress />} />
    <Route path="/coverage/:slug" element={<CityLanding />} />
    <Route path="/battlefield" element={<Battlefield />} />
    <Route path="/predatory" element={<Battlefield />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <OfflineBanner />
          <AppRoutes />
          <NativeBottomNav />
          <AppStoreBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
