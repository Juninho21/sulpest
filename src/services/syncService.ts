import { supabase } from '../config/supabase';
import { STORAGE_KEYS } from './storageKeys';
import { Client } from './clientService';
import { Product } from '../types/product.types';
import { CompanyData } from './companyService';
import { Device } from '../types';
import { ServiceOrder } from '../types/serviceOrder';

export interface SyncResult {
  success: boolean;
  count: number;
  error?: string;
}

// Função para sincronizar empresa com o Supabase
export const syncCompanyToSupabase = async (): Promise<SyncResult> => {
  try {
    const companyData = localStorage.getItem(STORAGE_KEYS.COMPANY);
    if (!companyData) return { success: true, count: 0 };

    const company: CompanyData = JSON.parse(companyData);
    const { error } = await supabase
      .from('company')
      .upsert({
        ...company,
        updated_at: new Date().toISOString(),
        last_sync: new Date().toISOString()
      });

    return { success: !error, count: error ? 0 : 1 };
  } catch (error) {
    console.error('Erro ao sincronizar empresa:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// Função para sincronizar dispositivos com o Supabase
export const syncDevicesToSupabase = async (): Promise<SyncResult> => {
  try {
    const devicesData = localStorage.getItem(STORAGE_KEYS.DEVICES);
    if (!devicesData) return { success: true, count: 0 };

    const devices: Device[] = JSON.parse(devicesData);
    let successCount = 0;

    for (const device of devices) {
      const { error } = await supabase
        .from('devices')
        .upsert({
          ...device,
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        });

      if (!error) successCount++;
    }

    return { success: true, count: successCount };
  } catch (error) {
    console.error('Erro ao sincronizar dispositivos:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// Função para sincronizar ordens de serviço com o Supabase
export const syncServiceOrdersToSupabase = async (): Promise<SyncResult> => {
  try {
    const ordersData = localStorage.getItem(STORAGE_KEYS.SERVICE_ORDERS);
    if (!ordersData) return { success: true, count: 0 };

    const orders: ServiceOrder[] = JSON.parse(ordersData);
    let successCount = 0;

    for (const order of orders) {
      const { error } = await supabase
        .from('service_orders')
        .upsert({
          ...order,
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        });

      if (!error) successCount++;
    }

    return { success: true, count: successCount };
  } catch (error) {
    console.error('Erro ao sincronizar ordens de serviço:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// Função para sincronizar downloads com o Supabase
export const syncDownloadsToSupabase = async (): Promise<SyncResult> => {
  try {
    const downloadsData = localStorage.getItem(STORAGE_KEYS.DOWNLOADS);
    if (!downloadsData) return { success: true, count: 0 };

    const downloads = JSON.parse(downloadsData);
    let successCount = 0;

    for (const download of downloads) {
      const { error } = await supabase
        .from('downloads')
        .upsert({
          ...download,
          updated_at: new Date().toISOString(),
          last_sync: new Date().toISOString()
        });

      if (!error) successCount++;
    }

    return { success: true, count: successCount };
  } catch (error) {
    console.error('Erro ao sincronizar downloads:', error);
    return { success: false, count: 0, error: error.message };
  }
};

// Função para sincronizar todos os dados
export const syncAllData = async (): Promise<{
  company: SyncResult;
  clients: SyncResult;
  products: SyncResult;
  devices: SyncResult;
  serviceOrders: SyncResult;
  downloads: SyncResult;
}> => {
  const results = {
    company: await syncCompanyToSupabase(),
    clients: await syncClientsToSupabase(),
    products: await syncProductsToSupabase(),
    devices: await syncDevicesToSupabase(),
    serviceOrders: await syncServiceOrdersToSupabase(),
    downloads: await syncDownloadsToSupabase()
  };

  return results;
};