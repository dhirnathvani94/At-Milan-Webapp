import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, Search, Lock, Heart, Headphones, ChevronRight } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useMasterData } from '../store/masterDataStore';

export default function AboutPage() {
  const { admin_settings_kv } = useMasterData();
  const siteName = admin_settings_kv?.find((s: any) => s.key === 'platform_name')?.value || admin_settings_kv?.find((s: any) => s.key === 'site_title')?.value || 'AtMilan';

  const statProfiles = admin_settings_kv?.find(s => s.key === 'stat_profiles')?.value || '10,000+';
  const statMarriages = admin_settings_kv?.find(s => s.key === 'stat_marriages')?.value || '500+';
  const statYears = admin_settings_kv?.find(s => s.key === 'stat_years')?.value || '15+';
  const statHappyUsers = admin_settings_kv?.find(s => s.key === 'stat_happy_users')?.value || '98%';

  const missionTitle = admin_settings_kv?.find(s => s.key === 'mission_title')?.value || 'Connecting Hearts, Building Families';
  const missionText1 = admin_settings_kv?.find(s => s.key === 'mission_text_1')?.value || `${siteName} is a trusted matrimonial platform dedicated to helping families in our community find the perfect life partner. We believe in preserving cultural values while embracing modern matchmaking technology. Our platform ensures every profile is genuine and verified, giving families the confidence to connect.`;
  const missionText2 = admin_settings_kv?.find(s => s.key === 'mission_text_2')?.value || `Founded with a vision to simplify the matchmaking process, ${siteName} brings together tradition and technology to create meaningful connections that last a lifetime.`;

  const features = [
    {
      icon: <ShieldCheck className="text-primary" size={24} />,
      title: "Verified Profiles",
      description: "Every profile undergoes Aadhaar-based verification to ensure authenticity. Our team manually reviews each document for your safety."
    },
    {
      icon: <Users className="text-primary" size={24} />,
      title: "Community Focused",
      description: `Built exclusively for our community, ${siteName} understands your cultural values, traditions, and the importance of family in matchmaking.`
    },
    {
      icon: <Search className="text-primary" size={24} />,
      title: "Smart Matching",
      description: "Our intelligent algorithm analyzes 20+ parameters including education, location, lifestyle, and family values to suggest the most compatible matches."
    },
    {
      icon: <Lock className="text-primary" size={24} />,
      title: "Privacy First",
      description: "Your personal information is encrypted and protected. You control who can see your profile, photos, and contact details."
    },
    {
      icon: <Heart className="text-primary" size={24} />,
      title: "Proven Results",
      description: `With 500+ successful marriages and counting, ${siteName} has helped thousands of families find their perfect match.`
    },
    {
      icon: <Headphones className="text-primary" size={24} />,
      title: "24/7 Support",
      description: "Our dedicated support team is always available to help you with any queries, from profile creation to finding your match."
    }
  ];

  const stats = [
    { value: statProfiles, label: "Active Profiles" },
    { value: statMarriages, label: "Successful Marriages" },
    { value: statYears, label: "Years of Trust" },
    { value: statHappyUsers, label: "Satisfaction Rate" }
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-primary-700 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">About {siteName}</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>&gt;</span>
            <span className="text-white">About Us</span>
          </nav>
        </div>
      </section>

      {/* Our Mission */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <span className="text-primary uppercase tracking-wider font-semibold text-sm">Our Mission</span>
                <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2">{missionTitle}</h2>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed">
                {missionText1}
              </p>
              <p className="text-gray-600 text-lg leading-relaxed">
                {missionText2}
              </p>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl relative">
                <img 
                  src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&h=800&fit=crop" 
                  alt="Our Mission" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-heading font-bold text-center mb-12">Why Families Trust {siteName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all border-none bg-white">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold">{stat.value}</div>
                <div className="text-white/80 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Ready to Find Your Life Partner?</h2>
          <p className="text-gray-600 text-lg mb-8">Join {siteName} today — Registration is 100% Free!</p>
          <Link to="/register">
            <Button variant="primary" size="lg" className="px-12">
              Register Free <ChevronRight className="ml-2" size={20} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
