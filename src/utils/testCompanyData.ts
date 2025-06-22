import { supabase } from '../config/supabase';

export const testCompanyConnection = async () => {
  console.log('🧪 Testando conexão com tabela company...');
  
  try {
    // Teste 1: Verificar se a tabela existe
    const { data: tableExists, error: tableError } = await supabase
      .from('company')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Erro ao acessar tabela company:', tableError);
      return false;
    }
    
    console.log('✅ Tabela company acessível');
    
    // Teste 2: Verificar dados existentes
    const { data: companyData, error: dataError } = await supabase
      .from('company')
      .select('*');
    
    if (dataError) {
      console.error('❌ Erro ao buscar dados:', dataError);
      return false;
    }
    
    console.log('📊 Dados encontrados na tabela company:', companyData);
    console.log('📈 Total de registros:', companyData?.length || 0);
    
    // Teste 3: Verificar estrutura da tabela
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'company')
      .eq('table_schema', 'public');
    
    if (columnsError) {
      console.error('❌ Erro ao verificar estrutura:', columnsError);
    } else {
      console.log('📋 Estrutura da tabela company:', columns);
    }
    
    return true;
    
  } catch (error) {
    console.error('💥 Erro durante o teste:', error);
    return false;
  }
};

export const insertTestCompanyData = async () => {
  console.log('➕ Inserindo dados de teste na tabela company...');
  
  const testData = {
    id: 1,
    name: 'Empresa Teste Debug',
    cnpj: '12.345.678/0001-90',
    phone: '(11) 99999-9999',
    email: 'teste@empresa.com',
    address: 'Rua Teste, 123 - São Paulo/SP',
    logo_url: '',
    environmental_license: {
      number: 'LIC-TESTE-001',
      date: '2025-12-31'
    },
    sanitary_permit: {
      number: 'PERM-TESTE-001',
      expiry_date: '2025-12-31'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    const { data, error } = await supabase
      .from('company')
      .upsert(testData);
    
    if (error) {
      console.error('❌ Erro ao inserir dados de teste:', error);
      return false;
    }
    
    console.log('✅ Dados de teste inseridos com sucesso');
    return true;
    
  } catch (error) {
    console.error('💥 Erro durante inserção:', error);
    return false;
  }
}; 