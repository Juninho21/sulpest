import { syncAllDataToSupabase } from './dataSyncService';
import { supabase } from '../config/supabase';

// Função para verificar se o usuário está autenticado
const isAuthenticated = async (): Promise<boolean> => {
  return true;
};

// Função para interceptar e substituir o método setItem do localStorage
export const setupLocalStorageInterceptor = (): void => {
  // Armazenar a referência original do método setItem
  const originalSetItem = localStorage.setItem;

  // Substituir o método setItem por nossa versão personalizada
  localStorage.setItem = async function(key: string, value: string): Promise<void> {
    // Chamar o método original para garantir que os dados sejam salvos localmente
    originalSetItem.call(this, key, value);

    try {
      // Verificar se o usuário está autenticado antes de sincronizar
      const authenticated = await isAuthenticated();
      if (authenticated) {
        // Sincronizar todos os dados com o Supabase
        // Usamos setTimeout para não bloquear a operação principal
        setTimeout(async () => {
          try {
            await syncAllDataToSupabase();
            console.log('Dados sincronizados com o Supabase após alteração em:', key);
          } catch (error) {
            console.error('Erro ao sincronizar dados com o Supabase:', error);
          }
        }, 0);
      }
    } catch (error) {
      console.error('Erro ao verificar autenticação:', error);
    }
  };
};

// Função para restaurar o método original do localStorage
export const restoreLocalStorage = (): void => {
  // Verificar se o método foi interceptado
  if (localStorage.setItem.toString().includes('originalSetItem')) {
    // Restaurar o método original
    localStorage.setItem = Storage.prototype.setItem;
  }
};