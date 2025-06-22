import { supabase } from '../config/supabase';
import { STORAGE_KEYS, ADDITIONAL_KEYS } from './storageKeys';
import { storageService } from './storageService';
import { syncClientsToSupabase, syncProductsToSupabase, getClientsFromSupabase, getProductsFromSupabase } from './supabaseService';
import { syncDevicesToSupabase, syncServiceOrdersToSupabase } from './syncService';

// Interface para erro do Supabase
interface SupabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

// Interface para resultado da sincronização
export interface SyncResult {
  success: boolean;
  count: number;
  error?: string;
}

// Interface para status da sincronização
export interface SyncStatus {
  lastSync: Date;
  syncedItems: {
    clients: boolean;
    products: boolean;
    devices: boolean;
    serviceOrders: boolean;
    schedules: boolean;
    company: boolean;
    userData: boolean;
    signatures: boolean;
  };
}

// Chave para armazenar o status da sincronização
const SYNC_STATUS_KEY = 'safeprag_sync_status';

// Função para salvar o status da sincronização
export const saveSyncStatus = (status: SyncStatus): void => {
  localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
};

// Função para obter o status da sincronização
export const getSyncStatus = (): SyncStatus | null => {
  const statusJson = localStorage.getItem(SYNC_STATUS_KEY);
  if (!statusJson) return null;
  
  const status = JSON.parse(statusJson);
  status.lastSync = new Date(status.lastSync);
  return status;
};

// Função para sincronizar agendamentos com o Supabase (removida - agendamentos são gerenciados apenas no Supabase)
export const syncSchedulesToSupabase = async (): Promise<SyncResult> => {
  // Esta função não é mais necessária pois os agendamentos são gerenciados exclusivamente no Supabase
  // Retorna sucesso para manter compatibilidade com o código existente
  return { success: true, count: 0 };
};

// Função para sincronizar dados da empresa com o Supabase
export const syncCompanyToSupabase = async (): Promise<SyncResult> => {
  try {
    const company = localStorage.getItem(STORAGE_KEYS.COMPANY);
    if (!company) return { success: true, count: 0 };

    const companyData = JSON.parse(company);
    const { error } = await supabase
      .from('company')
      .upsert({
        ...companyData,
        updated_at: new Date().toISOString(),
        last_sync: new Date().toISOString()
      });

    return { success: !error, count: error ? 0 : 1, error: (error as SupabaseError)?.message };
  } catch (error) {
    console.error('Erro ao sincronizar dados da empresa:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
};

// Função para sincronizar dados do usuário com o Supabase
export const syncUserDataToSupabase = async (): Promise<SyncResult> => {
  try {
    const userData = localStorage.getItem(ADDITIONAL_KEYS.USER_DATA);
    if (!userData) return { success: true, count: 0 };

    const user = JSON.parse(userData);
    
    // Removendo campos desnecessários e garantindo apenas os campos que existem na tabela
    const userDataToSync = {
      id: 'sistema',
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'user',
      signature_url: user.signatureUrl || null,
      updated_at: new Date().toISOString(),
      last_sync: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('user_data')
      .upsert(userDataToSync);

    if (error) {
      console.error('Erro ao sincronizar dados do usuário:', error);
      return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: 1 };
  } catch (error) {
    console.error('Erro ao sincronizar dados do usuário:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
};

// Função para sincronizar assinaturas com o Supabase
export const syncSignaturesToSupabase = async (): Promise<SyncResult> => {
  try {
    const signatureData = localStorage.getItem(ADDITIONAL_KEYS.CLIENT_SIGNATURE);
    if (!signatureData) return { success: true, count: 0 };

    const signature = JSON.parse(signatureData);
    const userId = "sistema"; // ID padrão para todos os usuários
    
    // Separar assinaturas do cliente e do técnico
    const clientSignature = signature.clientSignature;
    const tecnicoSignature = signature.technicianSignature;
    let successCount = 0;

    if (clientSignature) {
      const { error } = await supabase
        .from('signatures')
        .upsert({
          user_id: userId,
          signature_data: { signature: clientSignature },
          signature_type: 'client',
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        });

      if (!error) successCount++;
    }

    if (tecnicoSignature) {
      const { error } = await supabase
        .from('signatures')
        .upsert({
          user_id: userId,
          signature_data: { signature: tecnicoSignature },
          signature_type: 'tecnico',
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        });

      if (!error) successCount++;
    }

    return { success: true, count: successCount };
  } catch (error: unknown) {
    console.error('Erro ao sincronizar assinaturas:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
};

// Função para obter agendamentos do Supabase
export const getSchedulesFromSupabase = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*');
    
    if (error) throw error;
    
    // Mapear os dados do Supabase para o formato esperado pela aplicação
    const mappedSchedules = (data || []).map(schedule => ({
      id: schedule.id,
      clientId: schedule.client_id,
      clientName: schedule.client_name || 'Cliente não encontrado',
      clientAddress: schedule.client_address || '',
      clientPhone: schedule.client_phone || '',
      serviceType: schedule.service_type || 'Controle de Pragas',
      date: schedule.date,
      time: schedule.time || '08:00',
      startTime: schedule.start_time || schedule.time || '08:00',
      duration: schedule.duration || '60',
      technician: schedule.technician || 'Técnico',
      notes: schedule.notes || '',
      status: schedule.status || 'pending'
    }));
    
    console.log('Agendamentos carregados do Supabase:', mappedSchedules);
    return mappedSchedules;
  } catch (error) {
    console.error('Erro ao obter agendamentos do Supabase:', error);
    return [];
  }
};

// Função para obter dados da empresa do Supabase
export const getCompanyFromSupabase = async (): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('company')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      const supabaseError = error as SupabaseError;
      if (supabaseError.code === 'PGRST116') {
        // Se houver múltiplos registros, pegar o mais recente
        const { data: companies, error: listError } = await supabase
          .from('company')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (listError) throw listError as SupabaseError;
        const company = companies?.[0];
        if (company) {
          // Mapear campos do banco para o formato esperado pelo frontend
          return {
            ...company,
            environmental_license: {
              number: company.environmental_license_number || '',
              date: company.environmental_license_validity || ''
            },
            sanitary_permit: {
              number: company.sanitary_permit_number || '',
              expiry_date: company.sanitary_permit_validity || ''
            }
          };
        }
        return null;
      }
      throw supabaseError;
    }
    
    if (data) {
      // Mapear campos do banco para o formato esperado pelo frontend
      return {
        ...data,
        environmental_license: {
          number: data.environmental_license_number || '',
          date: data.environmental_license_validity || ''
        },
        sanitary_permit: {
          number: data.sanitary_permit_number || '',
          expiry_date: data.sanitary_permit_validity || ''
        }
      };
    }
    
    return null;
  } catch (error: unknown) {
    console.error('Erro ao obter dados da empresa do Supabase:', error);
    return null;
  }
};

// Função para obter dados do usuário do Supabase
export const getUserDataFromSupabase = async (): Promise<any> => {
  try {
    // Primeiro, vamos tentar uma consulta simples
    const { data, error } = await supabase
      .from('user_data')
      .select();

    if (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return null;
    }

    // Retornar o primeiro registro encontrado
    return data?.[0] || null;
  } catch (error: unknown) {
    console.error('Erro ao obter dados do usuário do Supabase:', error);
    return null;
  }
};

// Função para obter assinaturas do Supabase
export const getSignaturesFromSupabase = async (): Promise<any> => {
  try {
    // Buscar assinatura do controlador
    const { data: controladorData } = await supabase
      .from('signatures')
      .select('*')
      .eq('signature_type', 'controlador')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Buscar assinatura do técnico
    const { data: tecnicoData } = await supabase
      .from('signatures')
      .select('*')
      .eq('signature_type', 'tecnico')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      controlador: controladorData || null,
      tecnico: tecnicoData || null
    };
  } catch (error) {
    console.error('Erro ao obter assinaturas do Supabase:', error);
    return null;
  }
};

// Função para obter ordens de serviço do Supabase
export const getServiceOrdersFromSupabase = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*');
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao obter ordens de serviço do Supabase:', error);
    return [];
  }
};

// Função para obter dispositivos do Supabase
export const getDevicesFromSupabase = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('devices')
      .select('*');
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Erro ao obter dispositivos do Supabase:', error);
    return [];
  }
};

// Função para sincronizar todos os dados com o Supabase
export const syncAllDataToSupabase = async (): Promise<{
  success: boolean;
  results: Record<string, SyncResult>;
}> => {
  const results: Record<string, SyncResult> = {};
  let allSuccess = true;
  
  // Sincronizar clientes
  results.clients = await syncClientsToSupabase();
  allSuccess = allSuccess && results.clients.success;
  
  // Sincronizar produtos
  results.products = await syncProductsToSupabase();
  allSuccess = allSuccess && results.products.success;
  
  // Sincronizar dispositivos
  results.devices = await syncDevicesToSupabase();
  allSuccess = allSuccess && results.devices.success;
  
  // Sincronizar ordens de serviço
  results.serviceOrders = await syncServiceOrdersToSupabase();
  allSuccess = allSuccess && results.serviceOrders.success;
  
  // Sincronizar agendamentos
  results.schedules = await syncSchedulesToSupabase();
  allSuccess = allSuccess && results.schedules.success;
  
  // Sincronizar dados da empresa
  results.company = await syncCompanyToSupabase();
  allSuccess = allSuccess && results.company.success;
  
  // Sincronizar dados do usuário
  results.userData = await syncUserDataToSupabase();
  allSuccess = allSuccess && results.userData.success;
  
  // Sincronizar assinaturas
  results.signatures = await syncSignaturesToSupabase();
  allSuccess = allSuccess && results.signatures.success;
  
  // Salvar status da sincronização
  saveSyncStatus({
    lastSync: new Date(),
    syncedItems: {
      clients: results.clients.success,
      products: results.products.success,
      devices: results.devices.success,
      serviceOrders: results.serviceOrders.success,
      schedules: results.schedules.success,
      company: results.company.success,
      userData: results.userData.success,
      signatures: results.signatures.success
    }
  });
  
  return { success: allSuccess, results };
};

// Função para carregar todos os dados do Supabase
export const loadAllDataFromSupabase = async (): Promise<{
  success: boolean;
  loaded: string[];
}> => {
  const loaded: string[] = [];
  let success = true;
  
  try {
    // Carregar clientes
    const clients = await getClientsFromSupabase();
    if (clients.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
      loaded.push('clients');
    }
    
    // Carregar produtos
    const products = await getProductsFromSupabase();
    if (products.length > 0) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      loaded.push('products');
    }
    
    // Carregar dispositivos
    const devices = await getDevicesFromSupabase();
    if (devices.length > 0) {
      storageService.saveDevices(devices);
      loaded.push('devices');
    }
    
    // Carregar ordens de serviço
    const serviceOrders = await getServiceOrdersFromSupabase();
    if (serviceOrders.length > 0) {
      storageService.saveServiceOrders(serviceOrders);
      loaded.push('serviceOrders');
    }
    
    // Carregar agendamentos (não salva mais no localStorage - apenas no Supabase)
    const schedules = await getSchedulesFromSupabase();
    if (schedules.length > 0) {
      loaded.push('schedules');
    }
    
    // Carregar dados da empresa
    const company = await getCompanyFromSupabase();
    if (company) {
      localStorage.setItem(STORAGE_KEYS.COMPANY, JSON.stringify(company));
      loaded.push('company');
    }
    
    // Carregar dados do usuário
    const userData = await getUserDataFromSupabase();
    if (userData) {
      localStorage.setItem(ADDITIONAL_KEYS.USER_DATA, JSON.stringify(userData));
      loaded.push('userData');
    }
    
    // Carregar assinaturas
    const signatures = await getSignaturesFromSupabase();
    if (signatures) {
      localStorage.setItem(ADDITIONAL_KEYS.CLIENT_SIGNATURE, JSON.stringify(signatures));
      loaded.push('signatures');
    }
    
    // Salvar status da sincronização
    saveSyncStatus({
      lastSync: new Date(),
      syncedItems: {
        clients: loaded.includes('clients'),
        products: loaded.includes('products'),
        devices: loaded.includes('devices'),
        serviceOrders: loaded.includes('serviceOrders'),
        schedules: loaded.includes('schedules'),
        company: loaded.includes('company'),
        userData: loaded.includes('userData'),
        signatures: loaded.includes('signatures')
      }
    });
    
    return { success, loaded };
  } catch (error) {
    console.error('Erro ao carregar dados do Supabase:', error);
    return { success: false, loaded };
  }
};