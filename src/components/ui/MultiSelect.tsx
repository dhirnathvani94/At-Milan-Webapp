import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';

interface MultiSelectProps {
  label?: string;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  maxSelect?: number;
  error?: string;
}

export default function MultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  maxSelect,
  error,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableOptions = options.filter(
    (opt) => !selectedValues.includes(opt) && opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: string) => {
    if (maxSelect && selectedValues.length >= maxSelect) return;
    onChange([...selectedValues, option]);
    setSearchTerm('');
  };

  const handleRemove = (option: string) => {
    onChange(selectedValues.filter((v) => v !== option));
  };

  const isMaxReached = maxSelect ? selectedValues.length >= maxSelect : false;

  return (
    <div className="w-full relative" ref={wrapperRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {maxSelect && <span className="text-xs text-gray-400 font-normal ml-1">(Max {maxSelect})</span>}
        </label>
      )}
      
      <div 
        className={`
          relative min-h-[42px] border rounded-lg bg-white p-1.5 transition-colors
          ${error ? 'border-red-500' : isOpen ? 'border-primary ring-1 ring-primary' : 'border-gray-300'}
        `}
      >
        <div className="flex flex-wrap gap-1.5 pr-8">
          {selectedValues.map((val) => (
            <span 
              key={val} 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm bg-primary-50 text-primary-700"
            >
              {val}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(val);
                }}
                className="hover:bg-primary-100 rounded-full p-0.5 focus:outline-none"
              >
                <X size={14} />
              </button>
            </span>
          ))}
          
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedValues.length === 0 ? placeholder : ''}
            disabled={isMaxReached}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-sm p-1 disabled:cursor-not-allowed"
          />
        </div>
        
        <div 
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
          onClick={() => !isMaxReached && setIsOpen(!isOpen)}
        >
          <ChevronDown size={18} />
        </div>
      </div>
      
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {isOpen && !isMaxReached && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {availableOptions.length > 0 ? (
            <ul className="py-1">
              {availableOptions.map((option) => (
                <li
                  key={option}
                  onClick={() => handleSelect(option)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  {option}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {searchTerm ? 'No matches found' : 'No more options'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
