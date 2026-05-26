import React from 'react';
import { Link } from 'react-router-dom';
import { useMasterData } from '../store/masterDataStore';

export default function TermsPage() {
  const { admin_settings_kv } = useMasterData();

  const contactEmail = admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com';
  const termsRaw = admin_settings_kv?.find((s: any) => s.key === 'terms_data')?.value;
  const terms: any[] = termsRaw
    ? (() => { try { return JSON.parse(termsRaw); } catch { return []; } })()
    : [];

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-primary to-primary-700 py-16 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-heading font-bold mb-4">Terms &amp; Conditions</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>&gt;</span>
            <span className="text-white">Terms &amp; Conditions</span>
          </nav>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-primary max-w-none">
            <p className="text-gray-500 mb-8">Last Updated: January 2024</p>
            <div className="space-y-10">
              {terms.map((term: any, idx: number) => (
                <section key={idx}>
                  <h2 className="text-2xl font-heading font-bold text-gray-900 mb-4">
                    {idx + 1}. {term.title}
                  </h2>
                  <p className="text-gray-600 leading-relaxed">{term.content}</p>
                </section>
              ))}
              {terms.length > 0 && (
                <section>
                  <p className="text-gray-600 leading-relaxed">
                    For all terms-related queries, contact us at{' '}
                    <span className="text-primary font-bold">{contactEmail}</span>.
                    We are committed to providing a safe and respectful environment for all our users.
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
