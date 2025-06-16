import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://badyvhzrjbemyqzeqlaw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error('Supabase Anon Key é necessária nas variáveis de ambiente');
}

// Inicializa o cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função para testar a conexão com o Supabase
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('config').select('*').limit(1);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    throw error;
  }
};

// Função para reconectar em caso de perda de conexão
export const reconnectSupabase = async (): Promise<void> => {
  console.log('🔄 Attempting to reconnect to Supabase...');
  // Como o cliente Supabase gerencia automaticamente as reconexões,
  // apenas verificamos se a conexão está funcionando
  await testSupabaseConnection();
};