import { supabase } from '../config/supabase';
import { STORAGE_KEYS } from './storageKeys';
import { CompanyData } from './companyService';
import { User } from '../types/user.types';
import { Schedule } from '../types/schedule.types';
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export interface SupabaseDataService {
  // Clientes
  getClients: () => Promise<any[]>;
  saveClient: (client: any) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;

  // Produtos
  getProducts: () => Promise<any[]>;
  saveProduct: (product: any) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  // Ordens de Serviço
  getServiceOrders: () => Promise<any[]>;
  saveServiceOrder: (order: any) => Promise<void>;
  deleteServiceOrder: (id: string) => Promise<void>;

  // Agendamentos
  getSchedules: () => Promise<any[]>;
  saveSchedule: (schedule: any) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;

  // Empresa
  getCompany: () => Promise<CompanyData | null>;
  saveCompany: (company: CompanyData) => Promise<void>;
  uploadCompanyLogo: (file: File) => Promise<string>;
  deleteCompanyLogo: (logoUrl: string) => Promise<void>;

  // Usuário
  getUserData: () => Promise<any>;
  saveUserData: (userData: any) => Promise<void>;
  uploadSignature: (file: File, type: 'client' | 'tecnico') => Promise<string>;
  deleteSignature: (signatureUrl: string) => Promise<void>;

  cleanupCompanyBucket: () => Promise<void>;
}

class SupabaseDataServiceImpl implements SupabaseDataService {
  // Clientes
  async getClients() {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) throw error;
    return data;
  }

  async saveClient(client: any): Promise<void> {
    try {
      // Só envia o id se for um UUID válido
      let idToSend = undefined;
      if (client.id && typeof client.id === 'string') {
        // Função validateUuid retorna true se for um UUID válido
        if (validateUuid(client.id)) {
          idToSend = client.id;
        }
      }
      const formattedData: any = {
        name: client.name,
        cnpj: client.cnpj,
        phone: client.phone,
        email: client.email,
        address: client.address,
        branch: client.branch,
        contact: client.contact,
        created_at: client.created_at,
        updated_at: new Date().toISOString()
      };
      if (idToSend) {
        formattedData.id = idToSend;
      }

      const { error } = await supabase
        .from('clients')
        .upsert(formattedData);

      if (error) {
        console.error('Erro ao salvar cliente:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      throw error;
    }
  }

  async deleteClient(id: string) {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Produtos
  async getProducts() {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    return data;
  }

  async saveProduct(product: any) {
    const { error } = await supabase
      .from('products')
      .upsert({
        ...product,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }

  async deleteProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Ordens de Serviço
  async getServiceOrders() {
    const { data, error } = await supabase.from('service_orders').select('*');
    if (error) throw error;
    return data;
  }

  async saveServiceOrder(order: any) {
    const { error } = await supabase
      .from('service_orders')
      .upsert({
        ...order,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }

  async deleteServiceOrder(id: string) {
    const { error } = await supabase
      .from('service_orders')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Usuários
  async getUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data;
  }

  async saveUser(user: any) {
    const { error } = await supabase
      .from('users')
      .upsert({
        ...user,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  }

  async deleteUser(id: string) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // Empresa
  async getCompany(): Promise<CompanyData | null> {
    try {
      const { data, error } = await supabase
        .from('company')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar dados da empresa:', error);
        return null;
      }

      if (data) {
        // Função para formatar a data para YYYY-MM-DD
        const formatDate = (date: Date | null) => {
          if (!date) return '';
          try {
            return new Date(date).toISOString().split('T')[0];
          } catch (e) {
            console.error('Erro ao formatar data:', e);
            return '';
          }
        };

        // Mapear os campos do Supabase para o formato do frontend
        return {
          id: data.id,
          name: data.name || '',
          cnpj: data.cnpj || '',
          phone: data.phone || '',
          address: data.address || '',
          email: data.email || '',
          logo_url: data.logo_url || '',
          document: data.document || '',
          environmental_license: {
            number: data.environmental_license_number || '',
            date: formatDate(data.environmental_license_validity)
          },
          sanitary_permit: {
            number: data.sanitary_permit_number || '',
            expiry_date: formatDate(data.sanitary_permit_validity)
          },
          created_at: data.created_at,
          updated_at: data.updated_at
        };
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar dados da empresa:', error);
      return null;
    }
  }

  async saveCompany(company: CompanyData): Promise<void> {
    try {
      const formattedData: any = {
        id: company.id,
        name: company.name,
        cnpj: company.cnpj,
        phone: company.phone,
        address: company.address,
        email: company.email,
        logo_url: company.logo_url,
        environmental_license_number: company.environmental_license?.number || '',
        environmental_license_validity: company.environmental_license?.date || '',
        sanitary_permit_number: company.sanitary_permit?.number || '',
        sanitary_permit_validity: company.sanitary_permit?.expiry_date || '',
        created_at: company.created_at,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('company')
        .upsert(formattedData);

      if (error) {
        console.error('Erro ao salvar dados da empresa:', error);
        throw error;
      }
    } catch (error) {
      console.error('Erro ao salvar dados da empresa:', error);
      throw error;
    }
  }

  async uploadCompanyLogo(file: File): Promise<string> {
    try {
      // Nome fixo para o logo
      const fileExt = file.name.split('.').pop();
      const filePath = `logos/logo.${fileExt}`;

      // Fazer upload do novo arquivo, sobrescrevendo o anterior
      const { error: uploadError } = await supabase
        .storage
        .from('company')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Erro ao fazer upload do arquivo:', uploadError);
        throw uploadError;
      }

      // Obter URL pública do novo arquivo
      const { data } = supabase
        .storage
        .from('company')
        .getPublicUrl(filePath);

      // Atualizar campo logo_url na tabela company
      await supabase
        .from('company')
        .update({ logo_url: data.publicUrl })
        .eq('id', 1);

      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload do logo:', error);
      throw error;
    }
  }

  async deleteCompanyLogo(logoUrl: string): Promise<void> {
    const fileName = logoUrl.split('/').pop();
    if (!fileName) return;

    const { error } = await supabase.storage
      .from('company')
      .remove([`logo/${fileName}`]);

    if (error) throw error;
  }

  async getUserData() {
    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Se houver múltiplos registros, pegar o mais recente
        const { data: users, error: listError } = await supabase
          .from('user_data')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (listError) throw listError;
        return users?.[0] || null;
      }
      throw error;
    }
    return data;
  }

  async saveUserData(userData: any): Promise<void> {
    const { error } = await supabase
      .from('users')
      .upsert({
        ...userData,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async uploadSignature(file: File, type: 'client' | 'tecnico'): Promise<string> {
    try {
      const fileName = `${type}/${Date.now()}_${file.name}`;
      console.log('Iniciando upload da assinatura:', fileName);
      
      const { error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Erro no upload da assinatura:', uploadError);
        throw uploadError;
      }

      console.log('Assinatura enviada com sucesso, obtendo URL pública');
      const { data: { publicUrl } } = supabase.storage
        .from('signatures')
        .getPublicUrl(fileName);

      console.log('URL pública da assinatura:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Erro detalhado ao fazer upload da assinatura:', error);
      throw error;
    }
  }

  async deleteSignature(signatureUrl: string): Promise<void> {
    const fileName = signatureUrl.split('/').pop();
    if (!fileName) return;

    const { error } = await supabase.storage
      .from('signatures')
      .remove([fileName]);

    if (error) throw error;
  }

  async getSchedules(): Promise<any[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async saveSchedule(schedule: any): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .upsert({
        ...schedule,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async deleteSchedule(id: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async cleanupCompanyBucket(): Promise<void> {
    try {
      // Buscar o logo_url atual
      const { data: company } = await supabase
        .from('company')
        .select('logo_url')
        .eq('id', 1)
        .single();

      // Listar todos os arquivos no bucket
      const { data: files } = await supabase.storage
        .from('company')
        .list('logos');

      if (files && files.length > 0) {
        // Filtrar apenas os arquivos que não são o atual
        const filesToRemove = files.filter(file => {
          const filePath = `logos/${file.name}`;
          const fileUrl = supabase.storage.from('company').getPublicUrl(filePath).data.publicUrl;
          return fileUrl !== company?.logo_url;
        });

        if (filesToRemove.length > 0) {
          const fileNames = filesToRemove.map(file => `logos/${file.name}`);
          await supabase.storage
            .from('company')
            .remove(fileNames);
        }
      }
    } catch (error) {
      console.error('Erro ao limpar bucket da empresa:', error);
    }
  }
}

export const supabaseDataService = new SupabaseDataServiceImpl();

export const uploadCompanyLogo = async (file: File): Promise<string> => {
  return supabaseDataService.uploadCompanyLogo(file);
};

export const saveCompany = async (company: CompanyData): Promise<void> => {
  return supabaseDataService.saveCompany(company);
};

export const getCompany = async (): Promise<CompanyData | null> => {
  return supabaseDataService.getCompany();
};

export const saveUserData = async (userData: any): Promise<void> => {
  return supabaseDataService.saveUserData(userData);
};

export const saveSchedule = async (schedule: any): Promise<void> => {
  return supabaseDataService.saveSchedule(schedule);
}; 