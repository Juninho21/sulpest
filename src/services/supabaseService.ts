import { supabase } from "../config/supabase";
import { STORAGE_KEYS } from './storageKeys';
import { Client } from './clientService';
import { Product } from '../types/product.types';

// Se quiser expor para o window para debug, faça assim:
(window as any).supabase = supabase;

// Interface para status da conexão
export interface ConnectionStatus {
  connected: boolean;
  lastChecked: Date;
  lastSync?: Date;
  error?: string;
}

// Chave para armazenar o status da conexão
const CONNECTION_STATUS_KEY = 'safeprag_supabase_connection';

// Função para verificar se o Supabase está configurado
export const isSupabaseConfigured = (): boolean => {
  return supabase !== null;
};

// Função para salvar o status da conexão
export const saveConnectionStatus = (status: ConnectionStatus): void => {
  localStorage.setItem(CONNECTION_STATUS_KEY, JSON.stringify(status));
};

// Função para obter o status da conexão
export const getConnectionStatus = (): ConnectionStatus | null => {
  const statusJson = localStorage.getItem(CONNECTION_STATUS_KEY);
  if (!statusJson) return null;
  
  const status = JSON.parse(statusJson);
  status.lastChecked = new Date(status.lastChecked);
  return status;
};

// Função para sincronizar clientes com o Supabase
export const syncClientsToSupabase = async (): Promise<{success: boolean, count: number, error?: string}> => {
  try {
    // Obter clientes do localStorage
    const clientsJson = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (!clientsJson) return { success: true, count: 0 };
    
    const clients: Client[] = JSON.parse(clientsJson);
    let successCount = 0;
    
    // Inserir ou atualizar cada cliente no Supabase
    for (const client of clients) {
      const { error } = await supabase
        .from('clients')
        .upsert({
          id: client.id,
          code: client.code,
          name: client.name,
          address: client.address,
          branch: client.branch,
          document: client.document,
          contact: client.contact,
          phone: client.phone,
          created_at: client.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (!error) successCount++;
    }
    
    // Atualizar status da sincronização
    saveConnectionStatus({
      connected: true,
      lastChecked: new Date(),
      lastSync: new Date()
    });
    
    return { success: true, count: successCount };
  } catch (error) {
    console.error('Erro ao sincronizar clientes:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// Função para sincronizar produtos com o Supabase
export const syncProductsToSupabase = async (): Promise<{success: boolean, count: number, error?: string}> => {
  try {
    // Obter produtos do localStorage
    const productsJson = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    if (!productsJson) return { success: true, count: 0 };
    
    const products: Product[] = JSON.parse(productsJson);
    let successCount = 0;
    
    // Inserir ou atualizar cada produto no Supabase
    for (const product of products) {
      const { error } = await supabase
        .from('products')
        .upsert({
          id: product.id,
          name: product.name,
          active_ingredient: product.activeIngredient,
          chemical_group: product.chemicalGroup,
          registration: product.registration,
          batch: product.batch,
          expiration_date: product.expirationDate,
          unit: product.unit,
          measure: product.measure,
          diluent: product.diluent,
          created_at: product.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (!error) successCount++;
    }
    
    // Atualizar status da sincronização
    saveConnectionStatus({
      connected: true,
      lastChecked: new Date(),
      lastSync: new Date()
    });
    
    return { success: true, count: successCount };
  } catch (error) {
    console.error('Erro ao sincronizar produtos:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// Função para obter clientes do Supabase
export const getClientsFromSupabase = async (): Promise<Client[]> => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*');
    
    if (error) throw error;
    
    // Mapear os dados para o formato esperado pelo aplicativo
    return data.map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      address: item.address,
      branch: item.branch,
      document: item.document,
      contact: item.contact,
      phone: item.phone
    }));
  } catch (error) {
    console.error('Erro ao obter clientes do Supabase:', error);
    return [];
  }
};

// Função para obter produtos do Supabase
export const getProductsFromSupabase = async (): Promise<Product[]> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*');
    
    if (error) throw error;
    
    // Mapear os dados para o formato esperado pelo aplicativo
    return data.map(item => ({
      id: item.id,
      name: item.name,
      activeIngredient: item.active_ingredient,
      chemicalGroup: item.chemical_group,
      registration: item.registration,
      batch: item.batch,
      expirationDate: item.expiration_date,
      unit: item.unit,
      measure: item.measure,
      diluent: item.diluent
    }));
  } catch (error) {
    console.error('Erro ao obter produtos do Supabase:', error);
    return [];
  }
};

// Função para criar as tabelas necessárias no Supabase (se não existirem)
export const setupSupabaseTables = async (): Promise<boolean> => {
  try {
    // Verificar se as tabelas já existem
    const { data: existingTables, error: checkError } = await supabase
      .from('clients')
      .select('id')
      .limit(1);
    
    // Se não houver erro, as tabelas já existem
    if (!checkError) return true;
    
    // Criar tabela de clientes
    await supabase.rpc('create_clients_table');
    
    // Criar tabela de produtos
    await supabase.rpc('create_products_table');
    
    return true;
  } catch (error) {
    console.error('Erro ao configurar tabelas no Supabase:', error);
    return false;
  }
};

export interface SupabaseConfig {
  is_connected: boolean;
  last_sync: string | null;
}

export const supabaseService = {
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('config').select('*').limit(1);
      return !error;
    } catch (error) {
      console.error('Erro ao testar conexão com Supabase:', error);
      return false;
    }
  },

  async syncData(localData: any, tableName: string): Promise<boolean> {
    try {
      const { error } = await supabase.from(tableName).upsert(localData);
      return !error;
    } catch (error) {
      console.error(`Erro ao sincronizar dados com ${tableName}:`, error);
      return false;
    }
  },

  async getData(tableName: string): Promise<any> {
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados de ${tableName}:`, error);
      return null;
    }
  },

  async updateConfig(config: SupabaseConfig): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({ 
          id: 1, 
          is_connected: config.is_connected,
          last_sync: config.last_sync
        });
      return !error;
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      return false;
    }
  },

  async getConfig(): Promise<SupabaseConfig | null> {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .single();
      if (error) throw error;
      return {
        is_connected: data.is_connected,
        last_sync: data.last_sync
      };
    } catch (error) {
      console.error('Erro ao buscar configuração:', error);
      return null;
    }
  },

  async syncCompany(company: any): Promise<boolean> {
    try {
      console.log('Objeto company antes de salvar:', company);
      const companyToSave = {
        id: 1, // ou o id correto da sua empresa
        ...company,
        environmental_license_number: company.environmentalLicense?.number || '',
        environmental_license_date: company.environmentalLicense?.date || '',
        sanitary_permit_number: company.sanitaryPermit?.number || '',
        sanitary_permit_expiry_date: company.sanitaryPermit?.expiryDate || '',
      };
      delete companyToSave.environmentalLicense;
      delete companyToSave.sanitaryPermit;

      console.log('Dados enviados para o Supabase:', companyToSave);

      const { error } = await supabase
        .from('company')
        .upsert(companyToSave);
      if (error) {
        console.error('Erro ao salvar no Supabase:', error);
      }
      return !error;
    } catch (error) {
      console.error('Erro ao sincronizar empresa:', error);
      return false;
    }
  },

  async getCompany(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      
      if (data) {
        const companyData = {
          ...data,
          environmentalLicense: {
            number: data.environmental_license_number || '',
            date: data.environmental_license_date || ''
          },
          sanitaryPermit: {
            number: data.sanitary_permit_number || '',
            expiryDate: data.sanitary_permit_expiry_date || ''
          }
        };
        return companyData;
      }
      return null;
    } catch (error) {
      console.error('Erro ao obter dados da empresa:', error);
      return null;
    }
  }
};

// Exemplo para migrar empresa
async function migrateCompanyFromLocalStorage() {
  const companyJson = localStorage.getItem('NOME_DA_CHAVE_DA_EMPRESA');
  if (!companyJson) return;
  const company = JSON.parse(companyJson);

  const companyToSave = {
    id: 1,
    ...company,
    environmental_license_number: company.environmentalLicense?.number || '',
    environmental_license_date: company.environmentalLicense?.date || '',
    sanitary_permit_number: company.sanitaryPermit?.number || '',
    sanitary_permit_expiry_date: company.sanitaryPermit?.expiryDate || '',
  };
  delete companyToSave.environmentalLicense;
  delete companyToSave.sanitaryPermit;

  const { error } = await supabase.from('company').upsert(companyToSave);
  if (error) {
    console.error('Erro ao migrar empresa:', error);
  } else {
    console.log('Empresa migrada com sucesso!');
  }
}