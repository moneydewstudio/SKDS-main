import React from 'react';
import { GeneratedQuestion, TkpPoints } from '@/core/types';

interface QuestionListViewProps {
  questions: GeneratedQuestion[];
  onSave: () => void;
  onReset: () => void;
  onGenerateNext: () => void;
  isSaving: boolean;
  isPreFetching: boolean;
  hasPreFetchedNews: boolean;
  hasDbConfig: boolean;
  onOpenConfig: () => void;
}

const QuestionListView: React.FC<QuestionListViewProps> = ({ 
  questions, onSave, onReset, onGenerateNext, isSaving, isPreFetching, hasPreFetchedNews, hasDbConfig, onOpenConfig 
}) => {
  
  // Helper to safely render content that might be an object (AI hallucination safeguard)
  const renderSafeText = (content: any) => {
    if (typeof content === 'string' || typeof content === 'number') return content;
    if (typeof content === 'object' && content !== null) {
      // If explanation or option comes as an object with keys (e.g. {A: "reason", B: "reason"}), 
      // render as a formatted list instead of crashing React
      return (
        <ul className="list-disc pl-4 mt-2 space-y-1">
          {Object.entries(content).map(([k, v]) => (
             <li key={k}><span className="font-bold">{k}:</span> {String(v)}</li>
          ))}
        </ul>
      );
    }
    return JSON.stringify(content);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Output Generator Soal</h2>
          <p className="text-gray-600">Ditemukan {questions.length} soal dari analisis berita.</p>
        </div>
        <div className="flex flex-wrap justify-center md:justify-end gap-3 w-full md:w-auto">
           <button
            onClick={onReset}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition text-sm font-medium"
          >
            Buat Baru
          </button>

          {/* New "Buat Soal Selanjutnya" Button */}
          <button
            onClick={onGenerateNext}
            disabled={!hasPreFetchedNews || isSaving}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm shadow-sm
              ${!hasPreFetchedNews || isSaving
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {isPreFetching ? (
               <>
                 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                   <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                   <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                 </svg>
                 Menyiapkan Berita...
               </>
            ) : (
              <>
                <span>✨</span> Buat Soal Selanjutnya
              </>
            )}
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50 shadow-sm text-sm"
          >
            {isSaving ? (
                <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Menyimpan...
                </>
            ) : (
                <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                    Simpan ke Neon DB
                </>
            )}
          </button>
        </div>
      </div>
      
      {!hasDbConfig && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                <span className="text-sm text-yellow-800">
                    Database belum terhubung. Konfigurasikan Neon DB untuk menyimpan soal.
                </span>
            </div>
            <button onClick={onOpenConfig} className="text-sm font-bold text-yellow-800 underline hover:text-yellow-900">
                Konfigurasi
            </button>
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={idx} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            {/* Header for each question */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-700">Soal #{idx + 1}</span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-500 font-medium">Topik: {q.meta.news_topic}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                    q.content.category === 'TIU' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                }`}>{q.content.category}</span>
            </div>
            
            <div className="p-6">
                <p className="text-gray-800 font-medium text-lg mb-6 leading-relaxed whitespace-pre-wrap">{q.content.question_text}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    {Object.entries(q.content.options).map(([key, val]) => {
                        const isCorrect = q.content.answer_key.correct_option === key;
                        
                        let borderClass = 'border-gray-200';
                        let bgClass = 'bg-white';
                        
                        if (isCorrect) {
                            borderClass = 'border-green-500';
                            bgClass = 'bg-green-50';
                        }

                        return (
                            <div key={key} className={`flex p-3 rounded border ${borderClass} ${bgClass}`}>
                                <div className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold mr-3 ${
                                    isCorrect 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-gray-200 text-gray-500'
                                }`}>
                                    {key}
                                </div>
                                <div className="flex-1 text-gray-800 text-sm">
                                    {renderSafeText(val)}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Explanation Section */}
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <h4 className="font-bold text-yellow-800 mb-2 text-sm uppercase">Kunci & Pembahasan</h4>
                    <div className="text-gray-700 text-sm leading-relaxed">
                        {renderSafeText(q.content.explanation)}
                    </div>
                </div>
            </div>
        </div>
      ))}
    </div>
  );
};

export default QuestionListView;
