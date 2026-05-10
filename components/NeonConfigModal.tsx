import React, { useState } from 'react';

interface NeonConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (connectionString: string) => void;
  savedConnectionString: string;
}

const NeonConfigModal: React.FC<NeonConfigModalProps> = ({ isOpen, onClose, onSave, savedConnectionString }) => {
  const [connStr, setConnStr] = useState(savedConnectionString);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-green-600">Postgres</span> Integration
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Hubungkan aplikasi ke Neon DB (Serverless Postgres) untuk menyimpan soal yang dihasilkan.
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Connection String (Postgres URL)
          </label>
          <input
            type="password"
            value={connStr}
            onChange={(e) => setConnStr(e.target.value)}
            placeholder="postgres://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Format: <code>postgres://user:password@host/dbname?sslmode=require</code>
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(connStr)}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
          >
            Simpan Konfigurasi
          </button>
        </div>
      </div>
    </div>
  );
};

export default NeonConfigModal;
