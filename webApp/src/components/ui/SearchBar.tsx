import { Search, X } from 'lucide-react';
import { t } from '@/i18n';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const resolvedPlaceholder = placeholder ?? t('chatList.search');
  return (
    <div className="pb-1">
      <div
        className="flex items-center gap-2 rounded-[10px] px-2 py-[5px]"
        style={{ backgroundColor: '#2C2C2E' }}
      >
        <Search size={16} color="#8E8E93" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
          className="bg-transparent text-[15px] text-white placeholder-[#ABABAF] outline-none w-full"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="Очистить поиск"
            className="flex-shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center"
            style={{ background: '#636366' }}
          >
            <X size={12} color="#fff" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
