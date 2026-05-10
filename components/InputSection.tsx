import React, { useState } from 'react';
import { SKD_SYLLABUS } from '../constants/skdSyllabus';

interface InputSectionProps {
  onGenerate: (text: string, categories: string[], isHots: boolean, selectedTopic?: string, useNews?: boolean) => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onGenerate, isLoading }) => {
  const [text, setText] = useState('');
  // Single selection state, default to TIU
  const [selectedCategory, setSelectedCategory] = useState<string>('TIU');
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [isHots, setIsHots] = useState(false);
  const [useNews, setUseNews] = useState(true);

  const availableTopics = SKD_SYLLABUS.filter(item => item.category === selectedCategory);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedTopic(''); // Reset topic when category changes
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Pass as array to maintain compatibility with Orchestrator
    onGenerate(text, [selectedCategory], isHots, selectedTopic || undefined, useNews);
  };

  const getButtonText = () => {
    if (isLoading) return 'Memproses...';
    if (!useNews) return `Buat Soal ${selectedCategory} (Tanpa Berita)`;
    if (!text.trim()) return `Cari Berita & Buat Soal ${selectedCategory}`;
    if (text.length < 200) return `Topik "${text.substring(0, 10)}..." -> Soal ${selectedCategory}`;
    return `Analisis Teks -> Soal ${selectedCategory}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto border-t-4 border-blue-600">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Input Berita / Topik</h2>
      <p className="text-sm text-gray-600 mb-4">
        Masukkan topik spesifik (misal: "IKN", "Pemilu") atau teks berita lengkap. <br/>
        <span className="font-semibold text-blue-600">Biarkan kosong</span> untuk mencari berita trending hari ini secara otomatis.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <textarea
            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none font-sans text-gray-700"
            placeholder="Ketik topik (contoh: 'Hilirisasi Nikel') atau biarkan kosong untuk berita trending otomatis..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isLoading}
          ></textarea>
          {/* Helper for empty state */}
          {!text.trim() && !isLoading && (
            <div className="absolute bottom-3 right-3 text-xs text-gray-400 italic pointer-events-none">
              Mode Otomatis: Berita Trending
            </div>
          )}
        </div>

        {/* Configuration Row */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-stretch">
            {/* Category Selection (Single Select) */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 flex-1 w-full">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Topik Spesifik (Opsional):</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="">Acak (Semua Topik {selectedCategory})</option>
                  {availableTopics.map((item, idx) => (
                    <option key={idx} value={`${item.subcategory} - ${item.topic}`}>
                      {item.subcategory} - {item.topic}
                    </option>
                  ))}
                </select>
            </div>

            {/* Toggles */}
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 w-full md:w-48 flex flex-col justify-center gap-4">
                 {/* HOTS Toggle */}
                 <div>
                   <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={isHots} 
                          onChange={(e) => setIsHots(e.target.checked)}
                          disabled={isLoading}
                        />
                        <div className={`w-10 h-6 rounded-full shadow-inner transition ${isHots ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition transform ${isHots ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Mode HOTS</span>
                   </label>
                   <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                      Soal lebih analitis & kompleks.
                   </p>
                 </div>

                 {/* Use News Toggle */}
                 <div>
                   <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={useNews} 
                          onChange={(e) => setUseNews(e.target.checked)}
                          disabled={isLoading}
                        />
                        <div className={`w-10 h-6 rounded-full shadow-inner transition ${useNews ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition transform ${useNews ? 'translate-x-4' : 'translate-x-0'}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Gunakan Berita</span>
                   </label>
                   <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                      Jika dimatikan, soal dibuat murni tanpa konteks berita.
                   </p>
                 </div>
            </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-6 rounded-md text-white font-bold text-lg shadow-md transition-all transform active:scale-95
            ${isLoading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg'
            }`}
        >
          {getButtonText()}
        </button>
      </form>
    </div>
  );
};

export default InputSection;