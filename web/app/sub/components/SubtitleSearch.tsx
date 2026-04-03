'use client';

import { useState } from 'react';

const languages = [
  { name: 'English', code: 'en' },
  { name: 'French', code: 'fr' },
  { name: 'Spanish', code: 'es' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'German', code: 'de' },
  { name: 'Italian', code: 'it' },
  { name: 'Chinese (Simplified)', code: 'zh-cn' },
];

interface SubtitleSearchProps {
  onSearch: (query: string, lang: string, year?: string) => void;
  isLoading: boolean;
}

export default function SubtitleSearch({ onSearch, isLoading }: SubtitleSearchProps) {
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('en');
  const [year, setYear] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query, lang, year);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Movie/Show name or IMDb ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-mono text-sm"
          />
        </div>
        
        <div className="flex gap-4">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-mono text-sm appearance-none cursor-pointer"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Year"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all font-mono text-sm"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="bg-white text-black font-bold px-8 py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm flex items-center justify-center min-w-[120px]"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
            ) : (
              'SEARCH'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
