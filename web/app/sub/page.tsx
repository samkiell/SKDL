'use client';

import { useState } from 'react';
import SubtitleSearch from './components/SubtitleSearch';
import SubtitleCard from './components/SubtitleCard';
import DownloadModal from './components/DownloadModal';
import AdBanner from '../components/AdBanner';

interface SubtitleResult {
  id: string;
  title: string;
  year: string | number;
  language: string;
  downloads: number;
  rating: number;
  release_name: string;
  file_id: string;
  imdb_id: string;
  isBestMatch?: boolean;
  subtitleUrl?: string;
}

export default function SubtitlesPage() {
  const [results, setResults] = useState<SubtitleResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SubtitleResult | null>(null);

  const handleSearch = async (q: string, lang: string, year?: string) => {
    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const url = new URL('/api/subtitles/search', window.location.origin);
      url.searchParams.append('q', q);
      url.searchParams.append('lang', lang);
      if (year) url.searchParams.append('year', year);

      const res = await fetch(url.toString());
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch subtitles');
      }

      setResults(data.results || []);
      if (data.results?.length === 0) {
        setError('No subtitles found for your query.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during search.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (result: SubtitleResult) => {
    try {
      const release_name = result.release_name;

      // Handle MovieBox direct proxy download
      if (result.subtitleUrl) {
          const downloadUrl = `/api/proxy?url=${encodeURIComponent(result.subtitleUrl)}&filename=${encodeURIComponent(release_name)}.srt&dl=1`;
          window.location.href = downloadUrl;
          setSelectedResult(null);
          return;
      }

      const res = await fetch('/api/subtitles/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: result.file_id, release_name }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to download subtitle');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${release_name}.srt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Close modal after download begins
      setSelectedResult(null);
    } catch (err: any) {
      alert(err.message || 'Failed to download subtitle.');
    }
  };

  return (
    <main className="flex-1 w-full bg-black min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-6 pb-4 px-4 md:px-8 border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl blur-[100px] bg-gradient-to-tr from-zinc-800 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10 space-y-8 text-center flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left flex-1">
                <h1 className="text-4xl md:text-6xl font-space font-bold tracking-tighter text-white">
                    FIND YOUR <span className="text-zinc-500">SUBTITLES</span>
                </h1>
                <p className="font-mono text-zinc-500 text-xs md:text-sm uppercase tracking-[0.3em]">
                    Direct access to millions of subtitle files
                </p>
                <div className="pt-2">
                  <SubtitleSearch onSearch={handleSearch} isLoading={isLoading} />
                </div>
            </div>

            <div className="w-full md:w-auto opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all scale-75 md:scale-100 origin-center md:origin-right">
                <AdBanner />
            </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="max-w-7xl mx-auto px-4 md:px-8 py-4">
        <div className="mb-2">
            <AdBanner />
        </div>
        
        {isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-64 bg-zinc-950 border border-white/5 animate-pulse rounded-xl"></div>
                ))}
            </div>
        )}

        {error && !isLoading && (
            <div className="text-center py-20 space-y-4">
                <p className="font-mono text-zinc-500 text-sm">{error}</p>
                <div className="w-12 h-0.5 bg-zinc-900 mx-auto"></div>
            </div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {results.map((result) => (
              <SubtitleCard 
                key={result.id} 
                result={result} 
                onDownloadClick={(res) => handleDownload(res)}
              />
            ))}
          </div>
        )}

        {!isLoading && !error && results.length === 0 && (
            <div className="text-center py-40 flex flex-col items-center justify-center opacity-20">
                <div className="mb-4">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest">Awaiting Search Input</p>
            </div>
        )}
      </section>

      {/* Modal is bypassed for Best Match but kept for OS results */}
      {selectedResult && (
        <DownloadModal 
          result={selectedResult} 
          onClose={() => setSelectedResult(null)}
          onDownload={() => handleDownload(selectedResult)}
        />
      )}
    </main>
  );
}
