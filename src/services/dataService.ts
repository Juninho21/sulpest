import { storageService } from './storageService';
import { supabase } from '../config/supabase';
import { getConnectionStatus } from './supabaseService';
import { Client } from './clientService';
import { Product } from '../types/product.types';
import * as clientStorage from './clientStorage';
import * as productService from './productService';
import * as supabaseService from './supabaseService';

// Tipos
interface CompanyData {
  name: string;
  document: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

// Enum para definir o modo de armazenamento
export enum StorageMode {
  LOCAL = 'local',
  SUPABASE = 'supabase',
  HYBRID = 'hybrid' // Usa Supabase quando disponível, senão localStorage
}

// Keys para localStorage
const STORAGE_KEYS = {
  COMPANY: 'safeprag_company',
  CLIENTS: 'safeprag_clients',
};

// Chave para armazenar o modo de armazenamento
const STORAGE_MODE_KEY = 'safeprag_storage_mode';

// Função para obter o modo de armazenamento atual
export const getStorageMode = (): StorageMode => {
  const mode = localStorage.getItem(STORAGE_MODE_KEY);
  return (mode as StorageMode) || StorageMode.LOCAL;
};

// Função para definir o modo de armazenamento
export const setStorageMode = (mode: StorageMode): void => {
  localStorage.setItem(STORAGE_MODE_KEY, mode);
};

// Função para verificar se o Supabase está disponível
export const isSupabaseAvailable = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from('config').select('*').limit(1);
    return !error;
  } catch (error) {
    console.error('Erro ao verificar conexão com Supabase:', error);
    return false;
  }
};

// Serviço de Empresa
export const companyService = {
  getCompany: (): CompanyData | null => {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANY);
    return data ? JSON.parse(data) : null;
  },

  saveCompany: (data: CompanyData): void => {
    localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(data));
  },

  deleteCompany: (): void => {
    localStorage.removeItem(STORAGE_KEYS.COMPANY);
  }
};

// Serviço de Clientes
export const clientService = {
  getClients: async (): Promise<Client[]> => {
    const mode = getStorageMode();
    
    if (mode === StorageMode.LOCAL) {
      const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      return data ? JSON.parse(data) : [];
    }
    
    if (mode === StorageMode.SUPABASE && await isSupabaseAvailable()) {
      return await supabaseService.getClientsFromSupabase();
    }
    
    // Modo híbrido ou fallback para local
    if (mode === StorageMode.HYBRID && await isSupabaseAvailable()) {
      try {
        const clients = await supabaseService.getClientsFromSupabase();
        return clients.length > 0 ? clients : clientStorage.getClients();
      } catch (error) {
        console.error('Erro ao obter clientes do Supabase, usando localStorage:', error);
      }
    }
    
    // Fallback para localStorage
    const data = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return data ? JSON.parse(data) : [];
  },

  saveClient: async (client: Client): Promise<Client> => {
    const mode = getStorageMode();
    
    // Sempre salva localmente para garantir disponibilidade offline
    const clients = await clientService.getClients();
    const index = clients.findIndex(c => c.id === client.id);
    
    if (index >= 0) {
      clients[index] = client;
    } else {
      clients.push(client);
    }
    
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    
    // Se estiver usando Supabase ou modo híbrido e Supabase estiver disponível
    if ((mode === StorageMode.SUPABASE || mode === StorageMode.HYBRID) && await isSupabaseAvailable()) {
      try {
        await supabase
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      } catch (error) {
        console.error('Erro ao salvar cliente no Supabase:', error);
      }
    }
    
    return client;
  },

  deleteClient: async (id: string): Promise<boolean> => {
    const mode = getStorageMode();
    
    // Sempre deleta localmente
    const clients = await clientService.getClients();
    const filtered = clients.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(filtered));
    
    // Se estiver usando Supabase ou modo híbrido e Supabase estiver disponível
    if ((mode === StorageMode.SUPABASE || mode === StorageMode.HYBRID) && await isSupabaseAvailable()) {
      try {
        await supabase
          .from('clients')
          .delete()
          .eq('id', id);
      } catch (error) {
        console.error('Erro ao deletar cliente no Supabase:', error);
      }
    }
    
    return true;
  },

  searchClients: async (query: string): Promise<Client[]> => {
    const clients = await clientService.getClients();
    const searchTerm = query.toLowerCase();
    
    return clients.filter(client => 
      client.name.toLowerCase().includes(searchTerm) ||
      client.document.toLowerCase().includes(searchTerm)
    );
  }
};

// Serviço de Produtos - Apenas Supabase
export const productDataService = {
  getProducts: async (): Promise<Product[]> => {
    const isAvailable = await isSupabaseAvailable();
    if (!isAvailable) {
      throw new Error('Supabase não está disponível. Verifique sua conexão com a internet.');
    }
    
    try {
      return await supabaseService.getProductsFromSupabase();
    } catch (error) {
      console.error('Erro ao obter produtos do Supabase:', error);
      throw error;
    }
  },
  
  saveProduct: async (product: Product): Promise<Product> => {
    const isAvailable = await isSupabaseAvailable();
    if (!isAvailable) {
      throw new Error('Supabase não está disponível. Verifique sua conexão com a internet.');
    }
    
    try {
      // Preparar produto para salvamento (deixar o Supabase gerar UUID automaticamente)
      const productToSave = {
        ...product,
        id: product.id && product.id.trim() !== '' ? product.id : undefined // Deixar undefined para o Supabase gerar UUID
      };
      
      // Preparar dados para inserção/atualização
      const productData: any = {
        name: productToSave.name,
        active_ingredient: productToSave.activeIngredient,
        chemical_group: productToSave.chemicalGroup,
        registration: productToSave.registration,
        batch: productToSave.batch,
        expiration_date: productToSave.expirationDate,
        measure: productToSave.measure,
        diluent: productToSave.diluent,
        updated_at: new Date().toISOString()
      };
      
      // Incluir ID apenas se existir (para atualização)
      if (productToSave.id) {
        productData.id = productToSave.id;
      } else {
        productData.created_at = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('products')
        .upsert(productData, { onConflict: 'id' })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Mapear dados do Supabase de volta para o formato da aplicação
      const savedProduct: Product = {
        id: data.id,
        name: data.name,
        activeIngredient: data.active_ingredient,
        chemicalGroup: data.chemical_group,
        registration: data.registration,
        batch: data.batch,
        expirationDate: data.expiration_date,
        measure: data.measure,
        diluent: data.diluent
      };
      
      return savedProduct;
    } catch (error) {
      console.error('Erro ao salvar produto no Supabase:', error);
      throw error;
    }
  },
  
  deleteProduct: async (id: string): Promise<boolean> => {
    const isAvailable = await isSupabaseAvailable();
    if (!isAvailable) {
      throw new Error('Supabase não está disponível. Verifique sua conexão com a internet.');
    }
    
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao deletar produto no Supabase:', error);
      throw error;
    }
  }
};
