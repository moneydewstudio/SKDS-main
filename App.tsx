import React, { useState } from 'react';
import { runAgentWorkflow, ProcessStage } from './services/orchestratorService';
import { saveBatchToNeon } from './services/neonService';
import { GeneratedQuestion, AppState } from '@/core/types';
import InputSection from './components/InputSection';
import QuestionListView from './components/QuestionListView';
import NeonConfigModal from './components/NeonConfigModal';

// ⚠️ WARNING: Hardcoding credentials exposes them in client-side code.
const HARDCODED_NEON_STRING = "postgresql://neondb_owner:npg_IiMFKka4o6pw@ep-polished-rain-a1fl6wek-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"; 

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  
  // Detailed Agent Status
  const [agentStage, setAgentStage] = useState<ProcessStage>('IDLE');

  // Batch State
  const [questionBatch, setQuestionBatch] = useState<GeneratedQuestion[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // Persistence for "Next" generation
  const [lastConfig, setLastConfig] = useState<{categories: string[], isHots: boolean, selectedTopic?: string, useNews?: boolean} | null>(null);
  const [lastInput, setLastInput] = useState<string>('');
  
  // Neon State
  const [isNeonModalOpen, setIsNeonModalOpen] = useState(false);
  const [neonConnectionString, setNeonConnectionString] = useState(HARDCODED_NEON_STRING);
  const [isSavingToNeon, setIsSavingToNeon] = useState(false);

  const getStageLabel = (stage: ProcessStage) => {
    switch (stage) {
      case 'FETCHING_CONTEXT': return 'Mencari & Menganalisis Topik...';
      case 'GENERATING_CONTENT': return 'Menyusun Draft Soal & Opsi...';
      case 'QUALITY_CONTROL': return 'Quality Control & Validasi...';
      default: return 'Memproses...';
    }
  };

  const handleGenerate = async (text: string, categories: string[], isHots: boolean, selectedTopic?: string, useNews?: boolean) => {
    setAppState(AppState.LOADING);
    setErrorMsg('');
    setLastConfig({ categories, isHots, selectedTopic, useNews });
    setLastInput(text);
    
    try {
      const data = await runAgentWorkflow(
        text, 
        categories, 
        isHots, 
        selectedTopic,
        useNews,
        (stage) => setAgentStage(stage)
      );
      setQuestionBatch(data.questions);
      setAppState(AppState.GENERATED);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat membuat soal.');
      setAppState(AppState.ERROR);
    } finally {
      setAgentStage('IDLE');
    }
  };

  const handleGenerateNext = async () => {
    if (!lastConfig) return;
    
    setAppState(AppState.LOADING);
    setErrorMsg('');
    
    try {
      // Re-run workflow with empty input to trigger fresh trending news fetch
      // or re-use lastInput if it was specific text? 
      // For variety, let's fetch fresh context if input was generic, or reuse if specific.
      const data = await runAgentWorkflow(
        '', // Empty triggers Gemini Grounding for fresh news
        lastConfig.categories, 
        lastConfig.isHots,
        lastConfig.selectedTopic,
        lastConfig.useNews,
        (stage) => setAgentStage(stage)
      );
      setQuestionBatch(data.questions);
      setAppState(AppState.GENERATED);
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat membuat soal selanjutnya.');
      setAppState(AppState.ERROR);
    } finally {
      setAgentStage('IDLE');
    }
  };

  const handleReset = () => {
    setAppState(AppState.IDLE);
    setQuestionBatch([]);
    setErrorMsg('');
    setAgentStage('IDLE');
  };

  const handleFullReset = () => {
    setAppState(AppState.IDLE);
    setQuestionBatch([]);
    setErrorMsg('');
    setAgentStage('IDLE');
  };

  const handleSaveNeonConfig = (str: string) => {
    setNeonConnectionString(str);
    setIsNeonModalOpen(false);
  };

  const handleSaveToNeon = async () => {
    if (!neonConnectionString) {
        setIsNeonModalOpen(true);
        return;
    }
    
    setIsSavingToNeon(true);
    try {
        await saveBatchToNeon(neonConnectionString, questionBatch);
        alert('Berhasil menyimpan soal ke Neon DB!');
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsSavingToNeon(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 text-white py-4 px-6 shadow-md z-20 sticky top-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={handleFullReset}>
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-lg">
              S
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">CAT BKN Simulator</h1>
              <p className="text-xs text-gray-400">Powered by Gemini AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsNeonModalOpen(true)}
                className={`text-xs border px-2 py-1 rounded transition flex items-center gap-1 ${
                  neonConnectionString 
                    ? 'text-green-400 border-green-600 hover:bg-green-900' 
                    : 'text-gray-400 border-gray-600 hover:bg-gray-800'
                }`}
            >
                <span className={`w-2 h-2 rounded-full ${neonConnectionString ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                {neonConnectionString ? 'DB Configured' : 'Connect Neon DB'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        
        {/* Intro Branding & Input Section */}
        {appState === AppState.IDLE && (
           <div className="animate-fade-in-up mt-6">
             <div className="text-center mb-10">
               <h2 className="text-4xl font-extrabold text-gray-800 mb-4">
                 TIU Numerik Generator
               </h2>
               <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                 Sistem AI untuk menyusun soal TIU Numerik CPNS berkualitas tinggi.
               </p>
             </div>

             <InputSection onGenerate={handleGenerate} isLoading={false} />
           </div>
        )}

        {/* Loading State with Agents */}
        {appState === AppState.LOADING && (
          <div className="flex flex-col items-center justify-center h-80 animate-fade-in">
            <div className="relative w-24 h-24 mb-6">
                 {/* Visual indicator of multiple agents working */}
                 <div className={`absolute top-0 left-0 w-8 h-8 rounded-full bg-blue-500 animate-bounce ${agentStage === 'FETCHING_CONTEXT' ? 'opacity-100 scale-110' : 'opacity-40'}`}></div>
                 <div className={`absolute top-0 right-0 w-8 h-8 rounded-full bg-purple-500 animate-bounce delay-100 ${agentStage === 'GENERATING_CONTENT' ? 'opacity-100 scale-110' : 'opacity-40'}`}></div>
                 <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-orange-500 animate-bounce delay-200 ${agentStage === 'QUALITY_CONTROL' ? 'opacity-100 scale-110' : 'opacity-40'}`}></div>
            </div>
            
            <h3 className="text-xl font-bold text-gray-800 mb-2">AI Sedang Bekerja</h3>
            <div className="bg-white px-6 py-2 rounded-full shadow-sm border border-gray-200 text-blue-600 font-medium">
                {getStageLabel(agentStage)}
            </div>
            <p className="text-sm text-gray-400 mt-4 max-w-md text-center">
                Sistem sedang memproses dengan Gemini AI untuk menghasilkan soal yang akurat, menantang, dan terverifikasi.
            </p>
          </div>
        )}

        {appState === AppState.ERROR && (
          <div className="max-w-xl mx-auto text-center bg-red-50 p-8 rounded-lg border border-red-200 mt-10">
            <div className="text-red-500 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-red-800 mb-2">Terjadi Kesalahan</h3>
            <p className="text-red-600 mb-6">{errorMsg}</p>
            <button 
              onClick={handleReset}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {appState === AppState.GENERATED && questionBatch.length > 0 && (
          <QuestionListView 
            questions={questionBatch}
            onSave={handleSaveToNeon}
            onReset={handleFullReset}
            onGenerateNext={handleGenerateNext}
            isSaving={isSavingToNeon}
            isPreFetching={false} 
            hasPreFetchedNews={true} 
            hasDbConfig={!!neonConnectionString}
            onOpenConfig={() => setIsNeonModalOpen(true)}
          />
        )}

      </main>

      <NeonConfigModal 
        isOpen={isNeonModalOpen}
        onClose={() => setIsNeonModalOpen(false)}
        onSave={handleSaveNeonConfig}
        savedConnectionString={neonConnectionString}
      />

      <footer className="bg-gray-100 py-6 text-center text-gray-500 text-sm border-t border-gray-200 mt-auto">
        &copy; {new Date().getFullYear()} Simulator SKD AI. TIU Edition.
      </footer>
    </div>
  );
};

export default App;
