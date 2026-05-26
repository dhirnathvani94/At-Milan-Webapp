import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Clock, ChevronRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMasterData } from '../store/masterDataStore';
import { apiUrl } from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import TextArea from '../components/ui/TextArea';

export default function ContactPage() {
  const { admin_settings_kv } = useMasterData();
  const getSetting = (key: string, defaultValue: string) => {
    return admin_settings_kv?.find((s: any) => s.key === key)?.value || defaultValue;
  };

  const contactAddress = getSetting('contact_address', 'Community Center, Your City, India');
  const contactPhone = getSetting('contact_phone', '+91 98765 43210');
  const contactEmail = getSetting('contact_email', 'support@atmilan.com');
  const contactWorkingHours = getSetting('contact_working_hours', '10:00 AM - 7:00 PM');
  const contactMapLink = getSetting('contact_map_link', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3506.2233913121413!2d77.04083331508251!3d28.423906982499645!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d228f5518b1b3%3A0x6e78dbf1ab580e2f!2sCyber%20City%2C%20Gurugram%2C%20Haryana!5e1!3m2!1sen!2sin!4v1650000000000!5m2!1sen!2sin');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });
  const [showThankYou, setShowThankYou] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();

      setTicketNumber(data.ticketNumber);
      setShowThankYou(true);
      
      setFormData({
        name: '',
        email: '',
        subject: 'General Inquiry',
        message: ''
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const contactInfo = [
    {
      icon: <Mail className="text-primary" size={24} />,
      title: "Email Us",
      value: contactEmail,
      sub: "We respond within 24 hours"
    },
    {
      icon: <Phone className="text-primary" size={24} />,
      title: "Call Us",
      value: contactPhone,
      sub: "Mon-Sat, Working Hours"
    },
    {
      icon: <MapPin className="text-primary" size={24} />,
      title: "Visit Us",
      value: contactAddress,
      sub: "Headquarters"
    },
    {
      icon: <Clock className="text-primary" size={24} />,
      title: "Working Hours",
      value: "Monday - Saturday",
      sub: contactWorkingHours
    }
  ];

  // ── Professional Thank‑You Popup ──────────────────────────────────────
  if (showThankYou) {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{background:'rgba(10,10,30,0.78)', backdropFilter:'blur(8px)'}}>
        <div className="relative bg-white w-full max-w-[420px] rounded-[28px] shadow-[0_32px_80px_-10px_rgba(0,0,0,0.4)] overflow-hidden text-center">

          {/* ── Top maroon banner with background animation ── */}
          <div className="relative h-40 flex flex-col items-center justify-center bg-primary overflow-hidden">
            {/* Animated Background Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary-700 to-primary animate-pulse opacity-80" />
            
            {/* White light sweeping effect (using pulse as a safe fallback) */}
            <div className="absolute inset-0 bg-white/10 animate-pulse" style={{ animationDuration: '3s' }} />

            <div className="relative z-10 mb-3">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white/30">
                <CheckCircle className="text-white w-8 h-8 drop-shadow-md" />
              </div>
            </div>
            <h2 className="relative z-10 text-white font-heading font-bold text-2xl md:text-[28px] tracking-tight drop-shadow">Message Sent!</h2>
          </div>

          {/* ── Body ── */}
          <div className="px-6 md:px-8 py-6">
            <p className="text-gray-900 font-bold text-base md:text-lg mb-2 leading-snug">
              Thank you for reaching out!
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Our team will respond to your query within the next <strong>5-7 working days</strong>. We have sent a confirmation email to <strong>{formData.email || 'your email'}</strong>.
            </p>

            {/* ── Ticket Number ── */}
            <div className="flex flex-col items-center mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Your Ticket Number</p>
              <div className="bg-gray-50 border border-gray-200 text-gray-800 font-mono font-bold text-xl px-6 py-2.5 rounded-xl tracking-wider shadow-inner">
                {ticketNumber}
              </div>
            </div>

            {/* ── CTA ── */}
            <button
              onClick={() => setShowThankYou(false)}
              className="w-full py-3.5 rounded-2xl font-bold text-base text-white transition-all duration-200 hover:opacity-90 active:scale-95 shadow-lg bg-primary"
            >
              Done
            </button>
            <p className="text-[11px] text-gray-400 mt-3">We appreciate your patience</p>
          </div>
        </div>
      </div>
    );
  }
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-700 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Contact Us</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>&gt;</span>
            <span className="text-white">Contact Us</span>
          </nav>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card className="p-8 shadow-xl border-none">
              <h2 className="text-2xl font-heading font-bold mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Your Name *"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your full name"
                />
                <Input
                  label="Email Address *"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter your email"
                />
                <Select
                  label="Subject *"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  options={[
                    { value: 'General Inquiry', label: 'General Inquiry' },
                    { value: 'Profile Issue', label: 'Profile Issue' },
                    { value: 'Membership Query', label: 'Membership Query' },
                    { value: 'Report Issue', label: 'Report Issue' },
                    { value: 'Feedback', label: 'Feedback' },
                    { value: 'Suggestion', label: 'Suggestion' },
                    { value: 'Other', label: 'Other' }
                  ]}
                />
                <TextArea
                  label="Message *"
                  required
                  rows={5}
                  maxLength={1000}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="How can we help you?"
                />
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={loading}
                >
                  Send Message
                </Button>
              </form>
            </Card>

            {/* Contact Info */}
            <div className="space-y-6">
              <h2 className="text-2xl font-heading font-bold mb-6">Get in Touch</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {contactInfo.map((info, index) => (
                  <Card key={index} className="p-6 border-none bg-gray-50 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                      {info.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{info.title}</h3>
                      <p className="text-primary font-medium mt-1">{info.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{info.sub}</p>
                    </div>
                  </Card>
                ))}
              </div>
              
              <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 mt-8">
                <h3 className="text-xl font-bold mb-2">Our Location</h3>
                <p className="text-gray-600 mb-4">We are located in the heart of the city, easily accessible by public transport.</p>
                <div className="aspect-video bg-gray-200 rounded-2xl overflow-hidden shadow-inner relative">
                  {contactMapLink.includes('<iframe') ? (
                    <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: contactMapLink.replace('width="600"', 'width="100%"').replace('height="450"', 'height="100%"') }} />
                  ) : (
                    <iframe
                      src={contactMapLink}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen={true}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Google Map Location"
                    ></iframe>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Teaser */}
      <section className="py-12 bg-gray-50 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-heading font-bold mb-4">Have Questions?</h2>
          <p className="text-gray-600 mb-6">Check our frequently asked questions for quick answers to common queries.</p>
          <Link to="/faq">
            <Button variant="outline" className="px-8">
              View FAQ <ChevronRight className="ml-1" size={18} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
