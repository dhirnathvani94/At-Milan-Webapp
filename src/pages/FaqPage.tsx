import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { useMasterData } from '../store/masterDataStore';

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 py-5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left focus:outline-none group"
      >
        <span className={`text-lg font-medium transition-colors ${isOpen ? 'text-primary' : 'text-gray-800 group-hover:text-primary'}`}>
          {question}
        </span>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180 text-primary' : 'text-gray-400'}`}>
          <ChevronDown size={24} />
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
        <p className="text-gray-600 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const { admin_settings_kv } = useMasterData();

  const contactEmail = admin_settings_kv?.find((s: any) => s.key === 'contact_email')?.value || 'support@atmilan.com';
  const faqRaw = admin_settings_kv?.find((s: any) => s.key === 'faq_data')?.value;
  const faqCategories: any[] = faqRaw
    ? (() => { try { return JSON.parse(faqRaw); } catch { return []; } })()
    : [];

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-r from-primary to-primary-700 py-20 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4">Frequently Asked Questions</h1>
          <nav className="flex justify-center space-x-2 text-white/70 text-sm">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <span>&gt;</span>
            <span className="text-white">FAQ</span>
          </nav>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-16">
            {faqCategories.map((category: any, index: number) => (
              <div key={category.id || index}>
                <h2 className="text-2xl font-heading font-bold text-gray-900 mb-8 pb-2 border-b-2 border-primary/10 inline-block">
                  {category.title}
                </h2>
                <div className="space-y-2">
                  {(category.items || []).map((item: any, iIndex: number) => (
                    <FaqItem key={iIndex} question={item.question} answer={item.answer} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">Still have questions?</h2>
          <p className="text-gray-600 mb-8">If you couldn't find the answer you were looking for, feel free to contact our support team.</p>
          <Link to="/contact">
            <Button variant="primary" size="lg" className="px-10">
              Contact Us <ChevronRight className="ml-1" size={20} />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
