import { supabase } from '../config/supabase';

export const checkAndCleanupTestData = async () => {
  console.log('🧹 Verificando e limpando dados de teste...');
  
  try {
    // Buscar todos os dados da tabela company
    const { data: companyData, error } = await supabase
      .from('company')
      .select('*');
    
    if (error) {
      console.error('❌ Erro ao buscar dados:', error);
      return;
    }
    
    console.log('📊 Dados encontrados na tabela company:', companyData);
    
    // Identificar dados de teste
    const testData = companyData?.filter(item => 
      item.name?.includes('Teste') || 
      item.name?.includes('Debug') ||
      item.email?.includes('teste') ||
      item.cnpj === '12.345.678/0001-90'
    );
    
    if (testData && testData.length > 0) {
      console.log('⚠️ Dados de teste encontrados:', testData);
      
      // Remover dados de teste
      const { error: deleteError } = await supabase
        .from('company')
        .delete()
        .in('id', testData.map(item => item.id));
      
      if (deleteError) {
        console.error('❌ Erro ao remover dados de teste:', deleteError);
      } else {
        console.log('✅ Dados de teste removidos com sucesso');
      }
    } else {
      console.log('✅ Nenhum dado de teste encontrado');
    }
    
    // Verificar dados reais restantes
    const { data: remainingData, error: remainingError } = await supabase
      .from('company')
      .select('*');
    
    if (remainingError) {
      console.error('❌ Erro ao verificar dados restantes:', remainingError);
    } else {
      console.log('📋 Dados restantes na tabela:', remainingData);
    }
    
  } catch (error) {
    console.error('💥 Erro durante limpeza:', error);
  }
};

export const getRealCompanyData = async () => {
  console.log('🔍 Buscando dados reais da empresa...');
  
  try {
    const { data, error } = await supabase
      .from('company')
      .select('*')
      .not('name', 'ilike', '%teste%')
      .not('name', 'ilike', '%debug%')
      .not('email', 'ilike', '%teste%')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Erro ao buscar dados reais:', error);
      return null;
    }
    
    console.log('✅ Dados reais encontrados:', data);
    return data;
    
  } catch (error) {
    console.error('💥 Erro ao buscar dados reais:', error);
    return null;
  }
};

export const insertRealCompanyData = async () => {
  console.log('➕ Inserindo dados reais da empresa...');
  
  const realData = {
    id: 1,
    name: 'Sulpest',
    cnpj: '26.719.065/0001-85',
    phone: '54991284396',
    email: 'contato@sulpest.com.br',
    address: 'Rua Dr. Mario Brum, 657',
    logo_url: 'https://badyvhzrjbemyqzeqlaw.supabase.co/storage/v1/object/public/images//Sulpest.png',
    environmental_license_number: 'LO 01012/2025',
    environmental_license_validity: '2025-12-31',
    sanitary_permit_number: '',
    sanitary_permit_validity: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    const { data, error } = await supabase
      .from('company')
      .upsert(realData);
    
    if (error) {
      console.error('❌ Erro ao inserir dados reais:', error);
      return false;
    }
    
    console.log('✅ Dados reais inseridos com sucesso');
    return true;
    
  } catch (error) {
    console.error('💥 Erro durante inserção:', error);
    return false;
  }
};

export const ensureLogoUrl = async () => {
  console.log('🖼️ Garantindo que o logo da empresa está correto...');
  
  const correctLogoUrl = 'https://badyvhzrjbemyqzeqlaw.supabase.co/storage/v1/object/public/images//Sulpest.png';
  
  try {
    // Buscar dados da empresa Sulpest
    const { data: companyData, error: fetchError } = await supabase
      .from('company')
      .select('*')
      .eq('name', 'Sulpest')
      .maybeSingle();
    
    if (fetchError) {
      console.error('❌ Erro ao buscar dados da empresa:', fetchError);
      return false;
    }
    
    if (companyData) {
      // Se a URL do logo estiver diferente ou vazia, atualizar
      if (companyData.logo_url !== correctLogoUrl) {
        console.log('🔄 Atualizando URL do logo...');
        
        const { error: updateError } = await supabase
          .from('company')
          .update({ 
            logo_url: correctLogoUrl,
            updated_at: new Date().toISOString()
          })
          .eq('name', 'Sulpest');
        
        if (updateError) {
          console.error('❌ Erro ao atualizar logo:', updateError);
          return false;
        }
        
        console.log('✅ Logo atualizado com sucesso');
      } else {
        console.log('✅ Logo já está correto');
      }
    } else {
      console.log('⚠️ Empresa Sulpest não encontrada, inserindo dados...');
      return await insertRealCompanyData();
    }
    
    return true;
  } catch (error) {
    console.error('💥 Erro ao garantir URL do logo:', error);
    return false;
  }
}; 