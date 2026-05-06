import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const section = (title: string, body: string) => (
  <div style={{ marginBottom: 40 }}>
    <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 300, color: '#C9A84C', marginBottom: 12, letterSpacing: 1 }}>{title}</h2>
    <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 14, fontWeight: 300, color: 'rgba(240,235,224,0.75)', lineHeight: 1.9 }}>{body}</p>
  </div>
);

export default function Privacy() {
  return (
    <div style={{ background: '#0F0E0D', minHeight: '100vh', color: '#F0EBE0' }}>
      <Nav />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '120px 32px 80px' }}>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', color: '#C9A84C', marginBottom: 16 }}>Legal</p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 44, fontWeight: 300, letterSpacing: -1, marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontFamily: 'Jost, sans-serif', fontSize: 12, color: 'rgba(240,235,224,0.4)', marginBottom: 56, letterSpacing: 1 }}>Last updated: May 1, 2025</p>

        <div style={{ borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: 40 }}>
          {section('Overview', 'PropertyDNA ("we," "us," or "our") is a property intelligence platform operated by the Daniel Stuart Real Estate Team. This Privacy Policy describes how we collect, use, and protect information when you use our services at propertydna.com and thepropertydna.com.')}
          {section('Information We Collect', 'We collect information you provide directly: name, email address, and payment information when you register or subscribe. We also collect usage data automatically: pages visited, property addresses searched, reports generated, and browser/device identifiers. If you sign in with Google, Apple, or Facebook OAuth, we receive your name and email from those providers in accordance with your settings there.')}
          {section('How We Use Your Information', 'We use your information to generate property reports, process payments, send transactional emails (report delivery, billing receipts), and improve our platform. With your consent, we may send marketing emails about new features or market updates. You can unsubscribe at any time via the link in any email we send.')}
          {section('Property Data', 'PropertyDNA generates reports using publicly available county assessor records, permit databases, and third-party market data sources. We do not store personally identifiable information about property owners beyond what is required to deliver our service. Property addresses you search are used to generate your requested report and improve system accuracy.')}
          {section('Data Sharing', 'We do not sell your personal information. We share data only with service providers who operate under confidentiality agreements and are necessary to deliver our service: Supabase (database), Stripe (payment processing), Resend (email delivery), and RentCast (property data). We may disclose information if required by law or to protect our legal rights.')}
          {section('Cookies', 'We use essential cookies to maintain your session and authentication state. We use analytics cookies to understand how the platform is used. You can disable cookies in your browser settings, though some features may not function correctly without them.')}
          {section('Data Security', 'We use industry-standard encryption (TLS/HTTPS) for all data in transit and at rest. Access to user data is restricted to authorized personnel. We regularly review our security practices. No system is completely secure, and we cannot guarantee absolute security.')}
          {section('Your Rights', 'You may request access to, correction of, or deletion of your personal data by contacting us at privacy@propertydna.com. California residents have additional rights under CCPA, including the right to know what data we collect and the right to opt out of data sales (we do not sell data). EU/UK residents have rights under GDPR including access, correction, erasure, and portability.')}
          {section('Data Retention', 'We retain your account data for as long as your account is active. Property reports you generate are stored for 12 months. You may request earlier deletion at any time.')}
          {section('Children\'s Privacy', 'PropertyDNA is not directed to individuals under 18. We do not knowingly collect personal information from minors.')}
          {section('Changes to This Policy', 'We may update this Privacy Policy periodically. We will notify registered users of material changes via email. Continued use of the platform after changes constitutes acceptance of the updated policy.')}
          {section('Contact', 'For privacy-related questions or requests, contact us at privacy@propertydna.com or by mail at: Daniel Stuart Real Estate Team, Palm Springs, CA 92262.')}
        </div>
      </div>
      <Footer />
    </div>
  );
}
