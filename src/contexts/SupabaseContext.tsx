import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useSupabase } from '../hooks/useSupabase';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { toast } from 'react-toastify';

interface SupabaseContextData {
  isConnected: boolean;
  lastSync: string | null;
  isLoading: boolean;
  testConnection: () => Promise<boolean>;
  updateLastSync: () => Promise<void>;
  clients: {
    data: any[];
    isLoading: boolean;
    error: Error | null;
    loadData: () => Promise<void>;
    saveData: (item: any) => Promise<void>;
    deleteData: (id: string) => Promise<void>;
  };
  products: {
    data: any[];
    isLoading: boolean;
    error: Error | null;
    loadData: () => Promise<void>;
    saveData: (item: any) => Promise<void>;
    deleteData: (id: string) => Promise<void>;
  };
  serviceOrders: {
    data: any[];
    isLoading: boolean;
    error: Error | null;
    loadData: () => Promise<void>;
    saveData: (item: any) => Promise<void>;
    deleteData: (id: string) => Promise<void>;
  };
  users: {
    data: any[];
    isLoading: boolean;
    error: Error | null;
    loadData: () => Promise<void>;
    saveData: (item: any) => Promise<void>;
    deleteData: (id: string) => Promise<void>;
  };
  company: {
    data: any;
    isLoading: boolean;
    error: Error | null;
    loadData: () => Promise<void>;
    saveData: (item: any) => Promise<void>;
  };
}

const SupabaseContext = createContext<SupabaseContextData>({} as SupabaseContextData);

export const SupabaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isConnected, lastSync, isLoading, testConnection, updateLastSync } = useSupabase();
  const clients = useSupabaseData('clients');
  const products = useSupabaseData('products');
  const serviceOrders = useSupabaseData('service_orders');
  const users = useSupabaseData('users');
  const company = useSupabaseData('company');

  // Testar conexão e carregar dados ao iniciar
  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const connected = await testConnection();
        
        if (connected) {
          await updateLastSync();
        } else {
          toast.warning('Não foi possível conectar ao Supabase. Usando dados locais.');
        }
      } catch (error) {
        toast.error('Erro ao conectar ao Supabase');
      }
    };

    initializeConnection();
  }, []);

  return (
    <SupabaseContext.Provider
      value={{
        isConnected,
        lastSync,
        isLoading,
        testConnection,
        updateLastSync,
        clients,
        products,
        serviceOrders,
        users,
        company
      }}
    >
      {children}
    </SupabaseContext.Provider>
  );
};

export const useSupabaseContext = () => {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error('useSupabaseContext deve ser usado dentro de um SupabaseProvider');
  }
  return context;
}; 