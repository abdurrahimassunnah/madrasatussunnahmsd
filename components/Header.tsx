
import React from 'react';
import { BookOpen, Sparkles, Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        
        {/* Left Side: Menu Button */}
        <div className="flex-1 flex items-center">
          <button 
            onClick={onMenuClick}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors lg:hidden"
            aria-label="Open History"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Center: Brand Identity */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-50 p-1 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-center overflow-hidden w-11 h-11 relative">
              <img 
                src="https://madrasatussunnah.org/wp-content/uploads/cropped-logo-192x192.png" 
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src.includes('cropped-logo')) {
                    target.src = 'https://madrasatussunnah.org/favicon.ico';
                  } else {
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = parent.querySelector('.fallback-icon');
                      if (fallback) fallback.classList.remove('hidden');
                    }
                  }
                }}
                className="w-9 h-9 object-contain"
                alt="মাদরাসাতুস সুন্নাহ"
                referrerPolicy="no-referrer"
              />
              <BookOpen className="w-5 h-5 text-emerald-600 fallback-icon hidden" />
            </div>
            <div className="flex flex-col items-start">
              <h1 className="text-xl font-bold font-sans text-gray-900 leading-tight">মাদরাসাতুস সুন্নাহ</h1>
              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">এআই শিক্ষা সহায়ক</span>
            </div>
          </div>
        </div>

        {/* Right Side: Spacer */}
        <div className="flex-1" />
      </div>
    </header>
  );
};

export default Header;
