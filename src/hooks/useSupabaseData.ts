import { useState, useEffect } from 'react';
import { supabaseDataService } from '../services/supabaseDataService';
import { useSupabase } from './useSupabase';

export const useSupabaseData = <T>(tableName: string) => {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isConnected } = useSupabase();

  const loadData = async () => {
    if (!isConnected) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result;
      switch (tableName) {
        case 'clients':
          result = await supabaseDataService.getClients();
          break;
        case 'products':
          result = await supabaseDataService.getProducts();
          break;
        case 'service_orders':
          result = await supabaseDataService.getServiceOrders();
          break;
        case 'users':
          result = await supabaseDataService.getUsers();
          break;
        case 'company':
          result = await supabaseDataService.getCompany();
          break;
        default:
          throw new Error(`Tabela ${tableName} não suportada`);
      }
      setData(Array.isArray(result) ? result : [result]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao carregar dados'));
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = async (item: T) => {
    if (!isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      switch (tableName) {
        case 'clients':
          await supabaseDataService.saveClient(item);
          break;
        case 'products':
          await supabaseDataService.saveProduct(item);
          break;
        case 'service_orders':
          await supabaseDataService.saveServiceOrder(item);
          break;
        case 'users':
          await supabaseDataService.saveUser(item);
          break;
        case 'company':
          await supabaseDataService.saveCompany(item);
          break;
        default:
          throw new Error(`Tabela ${tableName} não suportada`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao salvar dados'));
    } finally {
      setIsLoading(false);
    }
  };

  const deleteData = async (id: string) => {
    if (!isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      switch (tableName) {
        case 'clients':
          await supabaseDataService.deleteClient(id);
          break;
        case 'products':
          await supabaseDataService.deleteProduct(id);
          break;
        case 'service_orders':
          await supabaseDataService.deleteServiceOrder(id);
          break;
        case 'users':
          await supabaseDataService.deleteUser(id);
          break;
        default:
          throw new Error(`Tabela ${tableName} não suportada`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erro ao excluir dados'));
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar dados quando o componente é montado
  useEffect(() => {
    loadData();
  }, []);

  // Carregar dados quando a conexão é estabelecida
  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected]);

  return {
    data,
    isLoading,
    error,
    loadData,
    saveData,
    deleteData
  };
}; 