import { supabase } from '../config/supabase';
import { supabaseDataService } from '../services/supabaseDataService';

export const debugCompanyData = async () => {
  console.log('🔍 Iniciando debug dos dados da empresa...');
  
  try {
    // 1. Testar conexão com Supabase
    console.log('1️⃣ Testando conexão com Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('config')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erro na conexão com Supabase:', testError);
      return;
    }
    console.log('✅ Conexão com Supabase OK');
    
    // 2. Verificar estrutura da tabela company
    console.log('2️⃣ Verificando estrutura da tabela company...');
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'company')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Erro ao verificar estrutura da tabela:', columnsError);
    } else {
      console.log('📋 Estrutura da tabela company:', columns);
    }
    
    // 3. Verificar dados existentes na tabela company
    console.log('3️⃣ Verificando dados existentes na tabela company...');
    const { data: companyData, error: companyError } = await supabase
      .from('company')
      .select('*');
    
    if (companyError) {
      console.error('❌ Erro ao buscar dados da empresa:', companyError);
    } else {
      console.log('📊 Dados da empresa no Supabase:', companyData);
    }
    
    // 4. Testar função getCompany do serviço
    console.log('4️⃣ Testando função getCompany do serviço...');
    const serviceData = await supabaseDataService.getCompany();
    console.log('🔧 Dados retornados pelo serviço:', serviceData);
    
    // 5. Verificar localStorage
    console.log('5️⃣ Verificando localStorage...');
    const localData = localStorage.getItem('company');
    if (localData) {
      console.log('💾 Dados no localStorage:', JSON.parse(localData));
    } else {
      console.log('💾 Nenhum dado encontrado no localStorage');
    }
    
    // 6. Verificar se há dados de backup
    console.log('6️⃣ Verificando dados de backup...');
    const backupData = localStorage.getItem('backup_company');
    if (backupData) {
      console.log('💾 Dados de backup:', JSON.parse(backupData));
    } else {
      console.log('💾 Nenhum backup encontrado');
    }
    
  } catch (error) {
    console.error('💥 Erro durante o debug:', error);
  }
};

// Função para testar salvamento de dados
export const testSaveCompanyData = async () => {
  console.log('🧪 Testando salvamento de dados da empresa...');
  
  const testData = {
    id: 1,
    name: 'Empresa Teste',
    cnpj: '12.345.678/0001-90',
    phone: '(11) 99999-9999',
    email: 'teste@empresa.com',
    address: 'Rua Teste, 123',
    logo_url: '',
    environmental_license: {
      number: 'LIC-001',
      date: '2025-12-31'
    },
    sanitary_permit: {
      number: 'PERM-001',
      expiry_date: '2025-12-31'
    }
  };
  
  try {
    await supabaseDataService.saveCompany(testData);
    console.log('✅ Dados salvos com sucesso');
    
    // Verificar se foram salvos
    const savedData = await supabaseDataService.getCompany();
    console.log('📊 Dados salvos:', savedData);
    
  } catch (error) {
    console.error('❌ Erro ao salvar dados:', error);
  }
};

// Função para limpar dados de teste
export const clearTestData = async () => {
  console.log('🧹 Limpando dados de teste...');
  
  try {
    const { error } = await supabase
      .from('company')
      .delete()
      .eq('name', 'Empresa Teste');
    
    if (error) {
      console.error('❌ Erro ao limpar dados:', error);
    } else {
      console.log('✅ Dados de teste removidos');
    }
    
  } catch (error) {
    console.error('💥 Erro ao limpar dados:', error);
  }
}; 