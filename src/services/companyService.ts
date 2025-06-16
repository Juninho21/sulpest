export const COMPANY_STORAGE_KEY = 'company_data';

export interface CompanyData {
  id?: number;
  name: string;
  cnpj: string;
  phone?: string;
  address?: string;
  email?: string;
  logo_url?: string;
  document?: string;
  environmental_license?: {
    number?: string;
    date?: string;
  };
  sanitary_permit?: {
    number?: string;
    expiry_date?: string;
  };
  created_at?: string;
  updated_at?: string;
}

// Função para buscar dados do localStorage
export const fetchCompanyFromLocalStorage = (): CompanyData | null => {
  try {
    const data = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!data) {
      return null;
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao buscar dados do localStorage:', error);
    throw error;
  }
};

// Função para salvar dados no localStorage
export const saveCompanyToLocalStorage = async (data: CompanyData, logoFile?: File | null): Promise<CompanyData> => {
  try {
    let updatedData = { ...data };

    if (logoFile) {
      // Não é possível armazenar arquivos no localStorage, apenas strings
      // Você pode considerar usar uma biblioteca como FileSaver.js para salvar o arquivo
      console.warn('Não é possível armazenar arquivos no localStorage');
    }

    updatedData.updated_at = new Date().toISOString();
    
    localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(updatedData));
    
    return updatedData;
  } catch (error) {
    console.error('Erro ao salvar no localStorage:', error);
    throw error;
  }
};

// Função para deletar dados do localStorage
export const deleteCompanyFromLocalStorage = async (): Promise<void> => {
  try {
    localStorage.removeItem(COMPANY_STORAGE_KEY);
  } catch (error) {
    console.error('Erro ao deletar do localStorage:', error);
    throw error;
  }
};

// Função para inicializar dados padrão da empresa
export const initializeDefaultCompanyData = () => {
  const defaultData: CompanyData = {
    name: 'Sulpest',
    cnpj: '26.719.065/0001/85',
    address: 'Rua Dr. Mario Brum, 657',
    phone: '54991284396',
    email: 'contato@sulpest.com.br',
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(defaultData));
  return defaultData;
};
