import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Поиск' }: SearchBarProps) {
  return (
    <div className="pb-1">
      <div
        className="flex items-center gap-2 rounded-[8px] px-2 py-[5px]"
        style={{ backgroundColor: '#2C2C2E' }}
      >
        <Search size={16} color="#8E8E93" aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="bg-transparent text-[15px] text-white placeholder-[#8E8E93] outline-none w-full"
        />
      </div>
    </div>
  );
}
