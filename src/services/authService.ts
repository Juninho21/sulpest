import { supabase } from '../config/supabase';
import { setupLocalStorageInterceptor, restoreLocalStorage } from './localStorageInterceptor';
import { loadAllDataFromSupabase } from './dataSyncService';

// Função para inicializar o interceptor do localStorage
export const initializeStorageInterceptor = (): void => {
  setupLocalStorageInterceptor();
  console.log('Interceptor do localStorage inicializado com sucesso');
};

// Função para verificar se o usuário está autenticado (sempre retorna true após remoção da página de login)
export const isAuthenticated = async (): Promise<boolean> => {
  return true;
};

// Função para carregar dados do Supabase após o login
export const loadUserData = async (): Promise<{
  success: boolean;
  loaded: string[];
}> => {
  try {
    // Verificar se o usuário está autenticado
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return { success: false, loaded: [] };
    }
    
    // Carregar todos os dados do Supabase
    const result = await loadAllDataFromSupabase();
    
    // Inicializar o interceptor do localStorage após carregar os dados
    initializeStorageInterceptor();
    
    return result;
  } catch (error) {
    console.error('Erro ao carregar dados do usuário:', error);
    return { success: false, loaded: [] };
  }
};

// Função para limpar dados e restaurar localStorage ao fazer logout
export const handleLogout = async (): Promise<void> => {
  try {
    // Restaurar o método original do localStorage
    restoreLocalStorage();
    
    // Fazer logout no Supabase
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  }
};