import React, { useState, useEffect } from 'react';
import { GeneratedQuestion } from '../types';

interface QuestionCardProps {
  data: GeneratedQuestion;
  currentIndex: number;
  totalQuestions: number;
  onAnswer: (selectedOption: string) => void;
  onReset: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ data, currentIndex, totalQuestions, onAnswer, onReset }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const { content, meta } = data;
  
  // Reset selection if data changes
  useEffect(() => {
    setSelected(null);
  }, [data]);

  const handleSubmit = () => {
    if (selected) {
      onAnswer(selected);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'TWK': return 'bg-red-100 text-red-800 border-red-200';
      case 'TIU': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'TKP': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden max-w-4xl mx-auto">
      {/* Header Bar */}
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div className="font-bold text-lg">SIMULASI CAT BKN</div>
        <div className="flex items-center gap-4">
            <div className="text-sm bg-blue-800 bg-opacity-50 px-3 py-1 rounded border border-blue-400">
                Soal {currentIndex + 1} / {totalQuestions}
            </div>
            <div className="text-sm bg-blue-700 px-3 py-1 rounded">
            Sisa Waktu: --:--
            </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row">
        {/* Left: Question Area */}
        <div className="flex-1 p-6 md:p-8">
          
          {/* Metadata Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <span className={`px-2.5 py-0.5 rounded border text-xs font-bold ${getCategoryColor(content.category)}`}>
              {content.category}
            </span>
            <span className="px-2.5 py-0.5 rounded border bg-gray-100 text-gray-600 border-gray-200 text-xs font-medium">
              Topik: {content.topic}
            </span>
            <span className="px-2.5 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-100 text-xs font-medium">
              HOTS
            </span>
            <span className="px-2.5 py-0.5 rounded border bg-purple-50 text-purple-600 border-purple-100 text-xs font-medium">
              Difficulty: {content.difficulty}/5
            </span>
          </div>

          {/* Question Text */}
          <div className="text-lg text-gray-800 font-medium leading-relaxed mb-8">
            {content.question_text}
          </div>

          {/* Options */}
          <div className="space-y-3">
            {(Object.keys(content.options) as Array<keyof typeof content.options>).map((optKey) => (
              <label 
                key={optKey}
                className={`flex items-start p-4 rounded-lg border-2 cursor-pointer transition-all hover:bg-blue-50
                  ${selected === optKey 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-gray-200 bg-white'
                  }`}
              >
                <input
                  type="radio"
                  name="option"
                  value={optKey}
                  checked={selected === optKey}
                  onChange={() => setSelected(optKey)}
                  className="hidden"
                />
                <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-2 mr-4 font-bold
                  ${selected === optKey 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                  }`}>
                  {optKey}
                </div>
                <div className="pt-0.5 text-gray-700">
                  {content.options[optKey]}
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-between items-center">
        <button
          onClick={onReset}
          className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 transition"
        >
          &larr; Batal & Kembali
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selected}
          className={`px-8 py-2.5 rounded shadow-sm font-bold text-white transition-all
            ${!selected 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-700 hover:shadow-md'
            }`}
        >
          Kunci Jawaban
        </button>
      </div>
    </div>
  );
};

export default QuestionCard;