import { useState, useEffect } from 'react';
import { supabaseService, SupabaseConfig } from '../services/supabaseService';

export const useSupabase = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const config = await supabaseService.getConfig();
    if (config) {
      setIsConnected(config.is_connected);
      setLastSync(config.last_sync);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    try {
      const isConnected = await supabaseService.testConnection();
      setIsConnected(isConnected);
      await supabaseService.updateConfig({ 
        is_connected: isConnected, 
        last_sync: lastSync 
      });
      return isConnected;
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateLastSync = async () => {
    const now = new Date().toISOString();
    setLastSync(now);
    await supabaseService.updateConfig({ 
      is_connected: isConnected, 
      last_sync: now 
    });
  };

  return {
    isConnected,
    lastSync,
    isLoading,
    testConnection,
    updateLastSync
  };
}; 