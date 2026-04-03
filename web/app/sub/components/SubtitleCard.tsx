'use client';

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
}

interface SubtitleCardProps {
  result: SubtitleResult;
  onDownloadClick: (result: SubtitleResult) => void;
}

export default function SubtitleCard({ result, onDownloadClick }: SubtitleCardProps) {
  const getLanguageColor = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'en': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'fr': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'es': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'ar': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pt': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'de': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'it': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'zh-cn': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-zinc-800 text-zinc-400 border-zinc-700/30';
    }
  };

  return (
    <div className="bg-zinc-950 border border-white/5 rounded-xl p-5 hover:border-white/20 transition-all group">
      <div className="flex flex-col h-full space-y-4">
        {/* Title & Year */}
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <h3 className="font-space font-bold text-lg leading-tight group-hover:text-[#e8ff47] transition-colors line-clamp-2">
              {result.title}
            </h3>
            <p className="font-mono text-xs text-zinc-500 mt-1 uppercase tracking-wider">
              {result.year}
            </p>
          </div>
          <span className={`px-2 py-1 rounded text-[10px] font-mono border ${getLanguageColor(result.language)} uppercase`}>
            {result.language}
          </span>
        </div>

        {/* Release Name */}
        <div className="flex-1">
          <p className="font-mono text-zinc-400 text-xs break-all line-clamp-2 bg-zinc-900/50 p-2 rounded-lg border border-white/5">
            {result.release_name}
          </p>
        </div>

        {/* Stats & Download Button */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
          <div className="flex items-center gap-4 font-mono text-[10px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span>DL:</span>
              <span className="text-zinc-300 font-bold">{result.downloads.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>★</span>
              <span className="text-zinc-300 font-bold">{result.rating > 0 ? result.rating.toFixed(1) : 'N/A'}</span>
            </div>
          </div>
          
          <button
            onClick={() => onDownloadClick(result)}
            className="text-xs font-mono font-bold bg-white/5 hover:bg-white text-white hover:text-black px-4 py-2 rounded-lg transition-all"
          >
            DOWNLOAD .SRT
          </button>
        </div>
      </div>
    </div>
  );
}
