import { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

export const LanguageToggle = () => {
  const { language, setLanguage, currentLanguage, languages } = useLanguage();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (lang) => {
    if (lang.disabled) return;
    setLanguage(lang.code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
        title="Change language"
        aria-label={`Language: ${currentLanguage.name}`}
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
        <span className="sm:hidden">{currentLanguage.code.toUpperCase()}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg shadow-black/10 border border-slate-200 py-1 z-50 overflow-hidden">
          {languages.map((lang) => {
            const isActive = language === lang.code;
            const isDisabled = !!lang.disabled;
            return (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang)}
                disabled={isDisabled}
                title={isDisabled ? 'Coming soon' : undefined}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors
                  ${isDisabled
                    ? 'text-slate-400 cursor-not-allowed opacity-60'
                    : isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <span className="text-base">{lang.flag}</span>
                <div className="flex flex-col items-start">
                  <span>{lang.nativeName}</span>
                  {lang.nativeName !== lang.name && (
                    <span className="text-[10px] text-slate-400">{lang.name}</span>
                  )}
                </div>
                {isActive && !isDisabled && (
                  <span className="ml-auto text-primary text-xs font-bold">&#10003;</span>
                )}
                {isDisabled && (
                  <span className="ml-auto text-[10px] text-slate-400 italic">soon</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageToggle;
