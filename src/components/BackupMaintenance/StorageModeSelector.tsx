import React, { useState, useEffect } from 'react';
import { StorageMode, getStorageMode, setStorageMode } from '../../services/dataService';
import { isSupabaseAvailable } from '../../services/supabaseService';

const StorageModeSelector: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<StorageMode>(StorageMode.LOCAL);
  const [supabaseStatus, setSupabaseStatus] = useState<boolean>(false);

  useEffect(() => {
    // Carregar o modo atual
    setCurrentMode(getStorageMode());
    
    // Verificar disponibilidade do Supabase
    checkSupabaseStatus();
  }, []);

  const checkSupabaseStatus = async () => {
    const available = await isSupabaseAvailable();
    setSupabaseStatus(available);
  };

  const handleModeChange = (mode: StorageMode) => {
    setStorageMode(mode);
    setCurrentMode(mode);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Modo de Armazenamento</h2>
      
      <div className="mb-4">
        <p className="mb-2">Selecione onde seus dados serão armazenados:</p>
        
        <div className="space-y-2">
          <div className="flex items-center">
            <input
              type="radio"
              id="local"
              name="storageMode"
              value={StorageMode.LOCAL}
              checked={currentMode === StorageMode.LOCAL}
              onChange={() => handleModeChange(StorageMode.LOCAL)}
              className="mr-2"
            />
            <label htmlFor="local" className="cursor-pointer">
              <span className="font-medium">Local</span> - Dados armazenados apenas no dispositivo
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="radio"
              id="supabase"
              name="storageMode"
              value={StorageMode.SUPABASE}
              checked={currentMode === StorageMode.SUPABASE}
              onChange={() => handleModeChange(StorageMode.SUPABASE)}
              disabled={!supabaseStatus}
              className="mr-2"
            />
            <label 
              htmlFor="supabase" 
              className={`cursor-pointer ${!supabaseStatus ? 'text-gray-400' : ''}`}
            >
              <span className="font-medium">Supabase</span> - Dados armazenados na nuvem
              {!supabaseStatus && <span className="ml-2 text-red-500">(Indisponível)</span>}
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              type="radio"
              id="hybrid"
              name="storageMode"
              value={StorageMode.HYBRID}
              checked={currentMode === StorageMode.HYBRID}
              onChange={() => handleModeChange(StorageMode.HYBRID)}
              disabled={!supabaseStatus}
              className="mr-2"
            />
            <label 
              htmlFor="hybrid" 
              className={`cursor-pointer ${!supabaseStatus ? 'text-gray-400' : ''}`}
            >
              <span className="font-medium">Híbrido</span> - Dados armazenados localmente e na nuvem
              {!supabaseStatus && <span className="ml-2 text-red-500">(Indisponível)</span>}
            </label>
          </div>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
        <p className="font-semibold mb-1">Informações:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Local:</strong> Dados disponíveis apenas neste dispositivo.</li>
          <li><strong>Supabase:</strong> Dados armazenados na nuvem, acessíveis de qualquer dispositivo.</li>
          <li><strong>Híbrido:</strong> Dados armazenados localmente e sincronizados com a nuvem quando possível.</li>
        </ul>
      </div>
    </div>
  );
};

export default StorageModeSelector;