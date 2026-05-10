import React from 'react';
import { GeneratedQuestion } from '../types';

interface ResultCardProps {
  data: GeneratedQuestion;
  userSelection: string;
  isLastQuestion: boolean;
  onNext: () => void;
  onReset: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ data, userSelection, isLastQuestion, onNext, onReset }) => {
  const { content } = data;
  const isTKP = content.category === 'TKP';
  const correctOption = content.answer_key.correct_option;
  
  // Calculate Score/Points
  let userPoints = 0;
  
  if (isTKP) {
    userPoints = content.answer_key.tkp_points?.[userSelection as keyof typeof content.answer_key.tkp_points] || 0;
  } else {
    userPoints = userSelection === correctOption ? 5 : 0;
  }

  const isPerfect = userPoints === 5;

  // Helper to safely render content that might be an object
  const renderSafeText = (text: any) => {
    if (typeof text === 'string' || typeof text === 'number') return text;
    if (typeof text === 'object' && text !== null) {
      return (
        <ul className="list-disc pl-4 mt-1 space-y-1">
          {Object.entries(text).map(([k, v]) => (
             <li key={k}><span className="font-bold">{k}:</span> {String(v)}</li>
          ))}
        </ul>
      );
    }
    return JSON.stringify(text);
  };

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-4xl mx-auto overflow-hidden animate-fade-in">
      <div className={`p-6 text-white text-center ${isPerfect ? 'bg-green-600' : 'bg-blue-600'}`}>
        <h2 className="text-2xl font-bold mb-1">Pembahasan Soal</h2>
        <p className="opacity-90">Kategori: {content.category}</p>
      </div>

      <div className="p-8">
        {/* Score Display */}
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="text-sm text-gray-500 uppercase tracking-wider mb-2">Poin Anda</div>
          <div className={`text-5xl font-extrabold ${isPerfect ? 'text-green-600' : isTKP ? 'text-blue-600' : 'text-red-500'}`}>
            {userPoints} <span className="text-2xl text-gray-400 font-medium">/ 5</span>
          </div>
        </div>

        {/* Answer Review */}
        <div className="space-y-4 mb-8">
          {(Object.keys(content.options) as Array<keyof typeof content.options>).map((optKey) => {
            const isSelected = userSelection === optKey;
            const isCorrect = correctOption === optKey;
            
            // Logic for coloring the option
            let containerClass = "border-gray-200 bg-gray-50 opacity-60";
            let badgeClass = "bg-gray-200 text-gray-500";
            
            if (isTKP) {
              const points = content.answer_key.tkp_points?.[optKey];
              if (isSelected) {
                containerClass = "border-blue-500 bg-blue-50 ring-1 ring-blue-500 opacity-100";
                badgeClass = "bg-blue-600 text-white";
              } else if (points === 5) {
                containerClass = "border-green-500 bg-green-50 opacity-100";
                badgeClass = "bg-green-600 text-white";
              }
            } else {
              // TWK / TIU
              if (isCorrect) {
                containerClass = "border-green-500 bg-green-50 opacity-100";
                badgeClass = "bg-green-600 text-white";
              } else if (isSelected && !isCorrect) {
                containerClass = "border-red-500 bg-red-50 opacity-100";
                badgeClass = "bg-red-600 text-white";
              } else if (isSelected && isCorrect) {
                 containerClass = "border-green-500 bg-green-50 ring-1 ring-green-500 opacity-100";
              }
            }

            return (
              <div key={optKey} className={`flex items-center p-3 rounded-lg border ${containerClass}`}>
                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mr-3 ${badgeClass}`}>
                  {optKey}
                </div>
                <div className="flex-1 text-gray-800 text-sm md:text-base">
                  {renderSafeText(content.options[optKey])}
                </div>
                {isTKP && (
                  <div className="ml-3 font-bold text-gray-500 text-sm">
                    {content.answer_key.tkp_points?.[optKey]} Poin
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation Text */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold text-yellow-800 mb-2 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/></svg>
            Kunci & Pembahasan
          </h3>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm md:text-base">
            {renderSafeText(content.explanation)}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
        <button
          onClick={onReset}
          className="text-gray-600 hover:text-red-600 font-medium transition"
        >
          Akhiri Sesi
        </button>
        <button
          onClick={onNext}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-8 rounded shadow transition-colors"
        >
          {isLastQuestion ? "Selesai & Ringkasan" : "Lanjut Soal Berikutnya →"}
        </button>
      </div>
    </div>
  );
};

export default ResultCard;
