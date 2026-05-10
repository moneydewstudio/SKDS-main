import React, { useState, useRef } from 'react';

interface PdfUploadSectionProps {
  onAnalyze: (base64: string, filename: string) => void;
  onBack: () => void;
  isLoading: boolean;
}

const PdfUploadSection: React.FC<PdfUploadSectionProps> = ({ onAnalyze, onBack, isLoading }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Mohon upload file PDF yang valid.');
      return;
    }
    
    // Max size check (e.g. 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('Ukuran file terlalu besar. Maksimal 10MB.');
        return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      onAnalyze(base64, file.name);
    };
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button 
        onClick={onBack}
        disabled={isLoading}
        className="mb-4 flex items-center text-sm text-gray-600 hover:text-gray-900 transition"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        Kembali ke Menu
      </button>

      <div className="bg-white rounded-lg shadow-md p-8 border-t-4 border-red-600">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Dokumen PDF</h2>
        <p className="text-gray-600 mb-8">
          Upload file PDF berisi soal latihan (untuk diekstrak) atau materi belajar (untuk dibuatkan soal). 
          AI akan memprosesnya menjadi format CAT BKN.
        </p>

        <div
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
            ${isDragging ? 'border-red-500 bg-red-50' : 'border-gray-300'}
          `}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden"
            disabled={isLoading}
          />
          
          <div className="flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="py-4">
                 <svg className="animate-spin h-10 w-10 text-red-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="font-semibold text-gray-700">Sedang Menganalisis PDF...</p>
                <p className="text-xs text-gray-500 mt-1">Ini mungkin memakan waktu hingga 1 menit tergantung ukuran file.</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                </div>
                <p className="text-lg font-medium text-gray-700 mb-1">
                  Klik untuk upload atau drag & drop
                </p>
                <p className="text-sm text-gray-500">PDF (Maks. 10MB)</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfUploadSection;