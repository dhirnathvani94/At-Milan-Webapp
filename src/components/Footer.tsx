import { Link } from 'react-router-dom'
import { Heart, Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react'
import { useMasterData } from '../store/masterDataStore'
import Logo from './Logo'

export default function Footer() {
  const { admin_settings_kv } = useMasterData();
  const getSetting = (key: string, defaultValue: string) => {
    return admin_settings_kv?.find((s: any) => s.key === key)?.value || defaultValue;
  }

  const contactAddress = getSetting('contact_address', '123 Matrimony Tower, Cyber City, Gurugram, Haryana 122002');
  const contactPhone = getSetting('contact_phone', '+91 98765 43210');
  const contactEmail = getSetting('contact_email', 'support@atmilan.com');
  
  const facebookLink = getSetting('facebook_link', '#');
  const twitterLink = getSetting('twitter_link', '#');
  const instagramLink = getSetting('instagram_link', '#');
  const youtubeLink = getSetting('youtube_link', '#');
  const siteTitle = getSetting('platform_name', 'At Milan');

  return (
    <footer className="bg-[#1a1a2e] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          
          {/* Brand Info */}
          <div className="space-y-6">
            <Logo white size="lg" variant="footer" shape="rounded" />
            <p className="text-gray-400 text-sm leading-relaxed mt-4">
              {siteTitle} is India's most trusted matrimonial platform, helping millions of people find their perfect life partner with verified profiles and secure matchmaking.
            </p>
            <div className="flex space-x-4">
              <a href={facebookLink} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href={twitterLink} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href={instagramLink} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href={youtubeLink} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white border-b border-white/10 pb-2 inline-block">Quick Links</h3>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-gray-400 hover:text-secondary transition-colors">About Us</Link></li>
              <li><Link to="/success-stories" className="text-gray-400 hover:text-secondary transition-colors">Success Stories</Link></li>
              <li><Link to="/membership" className="text-gray-400 hover:text-secondary transition-colors">Membership Plans</Link></li>
              <li><Link to="/register" className="text-gray-400 hover:text-secondary transition-colors">Register Free</Link></li>
              <li><Link to="/login" className="text-gray-400 hover:text-secondary transition-colors">Login</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white border-b border-white/10 pb-2 inline-block">Support</h3>
            <ul className="space-y-3">
              <li><Link to="/faq" className="text-gray-400 hover:text-secondary transition-colors">FAQs</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-secondary transition-colors">Contact Us</Link></li>
              <li><Link to="/privacy-policy" className="text-gray-400 hover:text-secondary transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-gray-400 hover:text-secondary transition-colors">Terms of Use</Link></li>
              <li><Link to="/safety-tips" className="text-gray-400 hover:text-secondary transition-colors">Safety Tips</Link></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white border-b border-white/10 pb-2 inline-block">Contact Info</h3>
            <ul className="space-y-4">
              <li className="flex items-start">
                <MapPin className="w-5 h-5 text-secondary mr-3 mt-1 flex-shrink-0" />
                <span className="text-gray-400">{contactAddress}</span>
              </li>
              <li className="flex items-center">
                <Phone className="w-5 h-5 text-secondary mr-3 flex-shrink-0" />
                <span className="text-gray-400">{contactPhone}</span>
              </li>
              <li className="flex items-center">
                <Mail className="w-5 h-5 text-secondary mr-3 flex-shrink-0" />
                <span className="text-gray-400">{contactEmail}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-8 border-t border-white/10 text-center md:flex md:justify-between md:text-left">
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} {siteTitle}. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex justify-center space-x-6 text-sm text-gray-500">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/sitemap" className="hover:text-white transition-colors">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
