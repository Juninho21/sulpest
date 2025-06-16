// @ts-ignore
import html2pdf from 'html2pdf.js';
import { ServiceOrderPDFData } from '../types/pdf.types';
import { getNextOSNumber } from './counterService';
import { supabaseService } from './supabaseService';
import { supabase } from '../config/supabase';
import { supabaseDataService } from './supabaseDataService';

interface CompanyData {
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  email: string;
  logoUrl?: string;
  environmentalLicense?: {
    number: string;
    date: string;
  };
  sanitaryPermit?: {
    number: string;
    expiryDate: string;
  };
}

interface PDFClient {
  code: string;
  name: string;
  branch: string;
  document: string;
  cnpj: string;
  city?: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
}

const COMPANY_STORAGE_KEY = 'safeprag_company_data';
const SERVICE_ORDERS_KEY = 'safeprag_service_orders';
const SCHEDULES_KEY = 'safeprag_schedules';

// Função para salvar o PDF no localStorage
export const storeServiceOrderPDF = (pdfBlob: Blob, serviceData: ServiceOrderPDFData): void => {
  try {
    // Converter Blob para base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64PDF = (reader.result as string).split(',')[1];
      
      // Determinar o tipo de serviço principal para exibição
      // Se houver múltiplos serviços, usa o primeiro da lista
      // Caso contrário, usa o serviço único (compatibilidade)
      const serviceType = serviceData.services && serviceData.services.length > 0
        ? serviceData.services[0].type
        : (serviceData.service ? serviceData.service.type : 'Serviço');
      
      // Armazena no localStorage
      const storedPDFs = JSON.parse(localStorage.getItem('safeprag_service_order_pdfs') || '{}');
      storedPDFs[serviceData.orderNumber] = {
        pdf: base64PDF,
        createdAt: new Date().toISOString(),
        clientName: serviceData.client.name,
        serviceType: serviceType,
        orderNumber: serviceData.orderNumber,
        // Armazena a lista completa de serviços para referência
        services: serviceData.services || [serviceData.service]
      };
      
      localStorage.setItem('safeprag_service_order_pdfs', JSON.stringify(storedPDFs));
    };
    reader.readAsDataURL(pdfBlob);
  } catch (error) {
    console.error('Erro ao armazenar PDF:', error);
    throw error;
  }
};

// Função para obter todos os PDFs armazenados
export const getAllStoredPDFs = () => {
  try {
    const storedPDFs = JSON.parse(localStorage.getItem('safeprag_service_order_pdfs') || '{}');
    return Object.entries(storedPDFs).map(([orderNumber, data]: [string, any]) => ({
      orderNumber,
      createdAt: data.createdAt,
      clientName: data.clientName,
      serviceType: data.serviceType,
      pdf: data.pdf
    }));
  } catch (error) {
    console.error('Erro ao recuperar PDFs:', error);
    return [];
  }
};

// Função para baixar um PDF específico
export const downloadPDFFromStorage = async (orderNumber: string): Promise<void> => {
  try {
    const storedPDFs = JSON.parse(localStorage.getItem('safeprag_service_order_pdfs') || '{}');
    const pdfData = storedPDFs[orderNumber];
    
    if (!pdfData) {
      throw new Error('PDF não encontrado');
    }

    // Detecta se está rodando no Capacitor nativo (não PWA)
    const isCapacitor = !!(window as any).Capacitor;
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true ||
                  document.referrer.includes('android-app://');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Só usa Capacitor se estiver realmente no app nativo, não no PWA
    if (isCapacitor && !isPWA) {
      // Para dispositivos móveis, usa uma abordagem mais direta
      try {
        const { FileService } = await import('./FileService');
        
        // Converte base64 diretamente para o FileService
        const fileName = `ordem-servico-${orderNumber}`;
        
        // Usa o Filesystem diretamente para evitar problemas com Blob
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        
        // Tenta salvar no diretório Downloads primeiro
        let result;
        try {
          result = await Filesystem.writeFile({
            path: `Download/${fileName}.pdf`,
            data: pdfData.pdf, // Usa diretamente os dados base64
            directory: Directory.ExternalStorage,
            recursive: true
          });
        } catch (externalError) {
          // Se falhar, tenta no diretório Documents
          result = await Filesystem.writeFile({
            path: `${fileName}.pdf`,
            data: pdfData.pdf,
            directory: Directory.Documents,
            recursive: true
          });
        }
        
        console.log('PDF salvo em:', result.uri);
        
        // Tenta abrir/compartilhar o arquivo
        try {
          await FileService.openPDF(result.uri);
        } catch (openError) {
          // Se não conseguir abrir, pelo menos informa que foi salvo
          console.log('PDF salvo com sucesso, mas não foi possível abri-lo automaticamente');
          throw new Error('PDF salvo com sucesso! Verifique a pasta Downloads ou Documentos do seu dispositivo.');
        }
        
      } catch (capacitorError) {
         console.error('Erro no Capacitor, tentando método web:', capacitorError);
         // Fallback para método web se o Capacitor falhar
         await downloadPDFWeb(pdfData.pdf, orderNumber);
       }
    } else if (isPWA && isMobile) {
      // Para PWA em dispositivos móveis, usa uma abordagem otimizada
      try {
        await downloadPDFForPWA(pdfData.pdf, orderNumber);
      } catch (pwaError) {
        console.error('Erro no PWA, usando método web padrão:', pwaError);
        await downloadPDFWeb(pdfData.pdf, orderNumber);
      }
    } else {
      // Usa o método tradicional para navegadores web
      await downloadPDFWeb(pdfData.pdf, orderNumber);
    }
  } catch (error) {
    console.error('Erro ao baixar PDF:', error);
    throw error;
  }
};

// Função específica para PWA em dispositivos móveis
const downloadPDFForPWA = async (base64Data: string, orderNumber: string): Promise<void> => {
  try {
    // Converte base64 para blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const fileName = `ordem-servico-${orderNumber}.pdf`;
    
    // Tenta usar Web Share API se disponível (Android PWA)
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Ordem de Serviço PDF',
          text: `PDF da Ordem de Serviço ${orderNumber}`,
          files: [file]
        });
        return;
      }
    }
    
    // Fallback: tenta usar File System Access API se disponível
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'PDF files',
            accept: { 'application/pdf': ['.pdf'] }
          }]
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (fsError) {
        console.log('File System Access API falhou:', fsError);
      }
    }
    
    // Fallback final: download tradicional
    await downloadPDFWeb(base64Data, orderNumber);
    
  } catch (error) {
    console.error('Erro no download PWA:', error);
    throw error;
  }
};

// Função auxiliar para download web
const downloadPDFWeb = async (base64Data: string, orderNumber: string): Promise<void> => {
  try {
    // Converte base64 para blob
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ordem-servico-${orderNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erro no download web:', error);
    throw error;
  }
}

export const generateServiceOrderPDF = async (
  serviceData: ServiceOrderPDFData
) => {
  // Garantir que o array de serviços exista
  if (!serviceData.services) {
    // Se não existir, criar um array com o serviço único (para compatibilidade)
    serviceData.services = serviceData.service ? [serviceData.service] : [];
  }
  try {
    // Gerar número sequencial da OS
    const osNumber = getNextOSNumber();
    serviceData.orderNumber = osNumber.toString();

    // Buscar dados da empresa do Supabase (compatível com a aba Empresa)
    const companyData = await supabaseDataService.getCompany();

    // Buscar dados da assinatura do cliente do localStorage
    const clientSignatureData = localStorage.getItem('client_signature_data');
    let clientData = null;
    if (clientSignatureData) {
      try {
        clientData = JSON.parse(clientSignatureData);
      } catch (error) {
        console.error('Erro ao parsear dados da assinatura do cliente:', error);
      }
    }

    // Buscar ordem de serviço ativa
    const serviceOrdersStr = localStorage.getItem(SERVICE_ORDERS_KEY);
    const serviceOrders = serviceOrdersStr ? JSON.parse(serviceOrdersStr) : [];
    const activeOrder = serviceOrders.find((order: any) => order.status === 'in_progress');

    // Se encontrou uma OS ativa, buscar o agendamento correspondente
    if (activeOrder) {
      const schedulesStr = localStorage.getItem(SCHEDULES_KEY);
      const schedules = schedulesStr ? JSON.parse(schedulesStr) : [];
      const schedule = schedules.find((s: any) => s.id === activeOrder.scheduleId);

      if (schedule) {
        // Buscar dados completos do cliente no Supabase
        let client = null;
        if (schedule.client_id || schedule.clientId) {
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', schedule.client_id || schedule.clientId)
            .single();
          if (!error && data) {
            client = data;
          }
        }
        // Atualizar os dados do cliente com as informações completas
        const pdfClient: PDFClient = {
          code: client?.code || 'N/A',
          name: client?.name || 'N/A',
          branch: client?.branch || 'N/A',
          document: client?.document || 'N/A',
          cnpj: client?.cnpj || 'N/A',
          city: client?.city || 'N/A',
          address: client?.address || 'N/A',
          contact: client?.contact || 'N/A',
          phone: client?.phone || 'N/A',
          email: client?.email || 'N/A'
        };
        serviceData.client = pdfClient;
      }
    }

    // Verifica se existem dados retroativos no localStorage
    const retroactiveDataStr = localStorage.getItem('retroactive_service_data');
    let retroactiveData = null;
    if (retroactiveDataStr) {
      try {
        retroactiveData = JSON.parse(retroactiveDataStr);
        // Se existem dados retroativos, atualiza os dados do serviço
        if (retroactiveData && retroactiveData.isRetroactive) {
          serviceData.date = retroactiveData.date;
          serviceData.startTime = retroactiveData.startTime;
          serviceData.endTime = retroactiveData.endTime || serviceData.endTime;
          console.log('Dados retroativos aplicados ao PDF:', retroactiveData);
        }
      } catch (error) {
        console.error('Erro ao parsear dados retroativos:', error);
      }
    }

    // Função para formatar data no padrão brasileiro (DD/MM/YYYY)
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        // Primeiro, verifica se a data já está no formato DD/MM/YYYY
        const brRegex = /^(\d{2})\/?(\d{2})\/?(\d{4})$/;
        const brMatch = dateStr.match(brRegex);
        
        if (brMatch) {
          // Já está no formato brasileiro, apenas padroniza
          return `${brMatch[1]}/${brMatch[2]}/${brMatch[3]}`;
        }
        
        // Verifica se está no formato YYYY-MM-DD (ISO)
        const isoRegex = /^(\d{4})-?(\d{2})-?(\d{2}).*$/;
        const isoMatch = dateStr.match(isoRegex);
        
        if (isoMatch) {
          // Converte de ISO para brasileiro
          return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        }
        
        // Tenta interpretar a data usando o objeto Date
        const date = new Date(dateStr);
        
        if (!isNaN(date.getTime())) {
          // Formatação manual para garantir o padrão brasileiro DD/MM/YYYY
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês começa em 0
          const year = date.getFullYear();
          
          return `${day}/${month}/${year}`;
        }
        
        // Se chegou aqui, não conseguiu interpretar a data
        console.warn('Formato de data não reconhecido:', dateStr);
        return dateStr; // Retorna o texto original
      } catch (error) {
        console.error('Erro ao formatar data:', error);
        return dateStr; // Em caso de erro, retorna o texto original
      }
    };

    // Função para formatar hora no padrão HH:mm:ss
    const formatTime = (timeStr: string) => {
      if (!timeStr) return '--:--:--';
      try {
        const timeParts = timeStr.split(':');
        if (timeParts.length < 3) return `${timeParts[0]}:${timeParts[1]}:00`;
        return `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
      } catch (error) {
        console.error('Erro ao formatar hora:', error);
        return timeStr; // Em caso de erro, retorna o texto original
      }
    };

    // Função para calcular a duração foi removida conforme solicitado


    // Criar um elemento temporário para o relatório
    const reportElement = document.createElement('div');
    reportElement.className = 'report-container';

    // Adiciona estilos globais
    const style = document.createElement('style');
    style.textContent = `
      @page {
        margin: 10mm 10mm 10mm 10mm;
      }
      .report-container {
        padding: 0;
        font-family: Arial, sans-serif;
      }
      .section-container {
        page-break-inside: avoid;
        margin-bottom: 10px;
      }
      .complementary-section {
        margin-top: 20px;
      }
      table {
        margin: 0;
        padding: 0;
        page-break-inside: avoid;
      }
    `;
    document.head.appendChild(style);

    // Cabeçalho principal
    const header = document.createElement('div');
    header.style.width = '100%';
    header.style.margin = '0';
    header.style.padding = '0';

    // Criar tabela para alinhar conteúdo
    header.innerHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 33%; vertical-align: top;">
            <img src="${companyData?.logo_url || ''}" alt="Logo" style="width: 150px; margin-bottom: 5px;">
          </td>
          <td style="width: 33%; text-align: center; vertical-align: middle;">
            <div style="font-size: 18px; font-weight: bold;">
              Ordem De Serviço
            </div>
          </td>
          <td style="width: 33%; text-align: right; vertical-align: top;">
            <div style="font-size: 14px; font-weight: bold; color: #000;">
              Nº O.S.: ${serviceData.orderNumber}
            </div>
          </td>
        </tr>
      </table>
      <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 12px;">
        <tr>
          <td style="width: 70%; line-height: 1.3;">
            <div>${companyData?.name || ''}</div>
            <div>CNPJ: ${companyData?.cnpj || ''}</div>
            <div>Endereço: ${companyData?.address || ''}</div>
            <div>Telefone: ${companyData?.phone || ''}</div>
            <div>Email: ${companyData?.email || ''}</div>
          </td>
          <td style="width: 30%; text-align: right; line-height: 1.3;">
            <div>Data: ${formatDate(serviceData.date)}</div>
            <div>Hora Início: ${formatTime(serviceData.startTime)}</div>
            <div>Hora Fim: ${formatTime(serviceData.endTime)}</div>
          </td>
        </tr>
      </table>
    `;

    // Container para licenças
    const licensesContainer = document.createElement('div');
    licensesContainer.style.width = '100%';
    licensesContainer.style.display = 'flex';
    licensesContainer.style.justifyContent = 'space-between';
    licensesContainer.style.fontSize = '12px';
    licensesContainer.style.marginTop = '5px';
    licensesContainer.style.marginBottom = '5px';
    licensesContainer.style.paddingTop = '5px';
    licensesContainer.style.borderTop = '1px solid #000';

    // Licença Ambiental
    const environmentalLicense = document.createElement('div');
    environmentalLicense.innerHTML = `Licença Ambiental: ${companyData?.environmental_license?.number || '000000'} - Validade: ${formatDate(companyData?.environmental_license?.date || '')}`;

    // Alvará Sanitário
    const sanitaryPermit = document.createElement('div');
    sanitaryPermit.style.textAlign = 'right';
    sanitaryPermit.innerHTML = `Alvará Sanitário: ${companyData?.sanitary_permit?.number || '000000'} - Validade: ${formatDate(companyData?.sanitary_permit?.expiry_date || '')}`;

    licensesContainer.appendChild(environmentalLicense);
    licensesContainer.appendChild(sanitaryPermit);

    // Linha divisória
    const divider = document.createElement('div');
    divider.style.width = '100%';
    divider.style.height = '1px';
    divider.style.backgroundColor = '#000';
    divider.style.margin = '5px 0';

    // Seção de serviço por contrato
    const serviceSection = document.createElement('div');
    serviceSection.style.marginTop = '10px';
    serviceSection.innerHTML = '';

    // Dados do cliente
    const clientSection = document.createElement('div');
    clientSection.style.margin = '0';
    clientSection.style.padding = '0';
    clientSection.innerHTML = `
      <div style="background-color: #1a73e8; color: white; padding: 5px 10px; margin: 10px 0;">Dados Do Cliente</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 11px;">
        <div>
          <div>Código Do Cliente: ${(serviceData.client as any).code || 'N/A'}</div>
          <div>Razão Social: ${(serviceData.client as any).branch || 'N/A'}</div>
          <div>Nome Fantasia: ${(serviceData.client as any).name || 'N/A'}</div>
          <div>CNPJ: ${(serviceData.client as any).cnpj || 'N/A'}</div>
          <div>Cidade: ${(serviceData.client as any).city || 'N/A'}</div>
        </div>
        <div>
          <div>Endereço: ${(serviceData.client as any).address || 'N/A'}</div>
          <div>Telefone: ${(serviceData.client as any).phone || 'N/A'}</div>
          <div>Contato: ${(serviceData.client as any).contact || 'N/A'}</div>
          <div>E-mail: ${(serviceData.client as any).email || 'N/A'}</div>
        </div>
      </div>
    `;

    // Informações dos serviços
    const servicesInfoSection = document.createElement('div');
    servicesInfoSection.style.marginTop = '20px';
    servicesInfoSection.style.backgroundColor = '#1a73e8';
    servicesInfoSection.style.color = 'white';
    servicesInfoSection.style.padding = '5px 10px';
    servicesInfoSection.innerHTML = 'Informações Dos Serviços';

    // Tabela de serviço
    const serviceTable = document.createElement('div');
    serviceTable.style.marginTop = '20px';
    
    // Verifica se temos múltiplos serviços ou apenas um serviço legado
    const servicesToRender = serviceData.services && serviceData.services.length > 0 
      ? serviceData.services 
      : (serviceData.service ? [serviceData.service] : []);
    
    // Título da seção
    serviceTable.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px;">Tratamento${servicesToRender.length > 1 ? 's' : ''}</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
        <thead>
          <tr style="background-color: #1a73e8; color: white;">
            <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Serviço</th>
            <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Praga Alvo</th>
            <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Local</th>
          </tr>
        </thead>
        <tbody>
          ${servicesToRender.map(service => service && service.type && service.target && service.location ? `
            <tr>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.type.charAt(0).toUpperCase() + service.type.slice(1)}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.target.charAt(0).toUpperCase() + service.target.slice(1)}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.location}</td>
            </tr>
          ` : '').join('')}
        </tbody>
      </table>
    `;
    
    // Verifica se algum serviço tem produto associado
    const hasProducts = servicesToRender.some(service => service.product);
    
    // Se houver produtos, cria a tabela de produtos
    if (hasProducts) {
      const productsTable = document.createElement('div');
      productsTable.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Produtos Utilizados</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background-color: #1a73e8; color: white;">
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Produto (Concen.)</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Princípio Ativo</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Grupo Químico</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Registro</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Lote</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Validade</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Qtde.</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Diluente</th>
            </tr>
          </thead>
          <tbody>
            ${servicesToRender.map(service => {
              // Verifica se há um produto associado a este serviço
              if (!service.product) {
                return ''; // Não renderiza a linha se não houver produto
              }
              // Se houver produto, renderiza a linha da tabela
              return `
                <tr>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.name}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.activeIngredient}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.chemicalGroup}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.registration}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.batch}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${formatDate(service.product.validity)}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.quantity}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${service.product.dilution}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      serviceTable.appendChild(productsTable);
    } else if (serviceData.product) {
      // Compatibilidade com o formato antigo
      const legacyProductTable = document.createElement('div');
      legacyProductTable.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Produtos Utilizados</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background-color: #1a73e8; color: white;">
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Produto (Concen.)</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Princípio Ativo</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Grupo Químico</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Registro</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Lote</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Validade</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Qtde.</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Diluente</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.name}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.activeIngredient}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.chemicalGroup}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.registration}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.batch}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${formatDate(serviceData.product.validity)}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.quantity}</td>
              <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${serviceData.product.dilution}</td>
            </tr>
          </tbody>
        </table>
      `;
      serviceTable.appendChild(legacyProductTable);
    }
    

    // Dispositivos monitorados - só cria se não for um dos tipos de serviço de tratamento ou inspeção
    let devicesSection = null;
    console.log('Tipo de serviço:', serviceData.service.type); // Debug
    const treatmentTypes = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_gel', 'inspeção', 'inspeçao'];
    
    // Criar a seção de dispositivos se houver dispositivos salvos
    if (serviceData.devices && serviceData.devices.length > 0) {
      devicesSection = document.createElement('div');
      devicesSection.style.marginTop = '20px';
      devicesSection.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Dispositivos Monitorados</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background-color: #1a73e8; color: white;">
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Dispositivos</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd; width: 10%;">Quant. Instalada</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Status</th>
              <th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Lista De Dispositivos</th>
            </tr>
          </thead>
          <tbody>
            ${serviceData.devices.map(device => {
              // Função para agrupar números em sequências
              const getSequences = (numbers: number[]): string => {
                if (numbers.length === 0) return '';
                
                const sortedNumbers = [...numbers].sort((a, b) => a - b);
                const sequences: string[] = [];
                let start = sortedNumbers[0];
                let prev = start;

                for (let i = 1; i <= sortedNumbers.length; i++) {
                  if (i === sortedNumbers.length || sortedNumbers[i] !== prev + 1) {
                    if (start === prev) {
                      sequences.push(start.toString());
                    } else {
                      sequences.push(`${start}-${prev}`);
                    }
                    if (i < sortedNumbers.length) {
                      start = sortedNumbers[i];
                      prev = start;
                    }
                  } else {
                    prev = sortedNumbers[i];
                  }
                }

                return sequences.join(', ');
              };

              return `
                <tr>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${device.type}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${device.quantity}</td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">
                    ${device.status
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((statusItem, index, array) => {
                        const percentage = ((statusItem.count / device.quantity) * 100).toFixed(1);
                        return `
                          <div style="font-size: 10px;">
                            ${statusItem.name} (${statusItem.count} - ${percentage}%)
                            ${index < array.length - 1 ? '<br><br>' : ''}
                          </div>
                        `;
                      }).join('')}
                  </td>
                  <td style="padding: 3px; border: 1px solid #ddd; text-align: center;">
                    ${device.status
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((statusItem, index, array) => {
                        const sequence = getSequences(statusItem.devices);
                        return `
                          ${statusItem.name}:
                          <br>
                          ${sequence}
                          ${index < array.length - 1 ? '<br><br>' : ''}
                        `;
                      }).join('')}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    // Seção de informações complementares
    const complementarySection = document.createElement('div');
    complementarySection.className = 'section-container complementary-section';
    complementarySection.style.marginTop = '20px';

    // Título das informações complementares
    const complementaryTitle = document.createElement('div');
    complementaryTitle.style.backgroundColor = '#1a75ff';
    complementaryTitle.style.color = 'white';
    complementaryTitle.style.padding = '5px 10px';
    complementaryTitle.style.marginBottom = '20px';
    complementaryTitle.innerHTML = 'Informações Complementares';
    complementarySection.appendChild(complementaryTitle);

    // Observações
    const observationsContainer = document.createElement('div');
    observationsContainer.style.marginBottom = '20px';
    observationsContainer.innerHTML = `
      <div style="margin-bottom: 10px;"><strong>Observações:</strong></div>
      <div style="min-height: 80px; border: 1px solid #ddd; padding: 10px; margin-bottom: 20px;">
        ${serviceData.observations || ''}
      </div>
    `;
    complementarySection.appendChild(observationsContainer);

    // Assinaturas
    const signaturesSection = document.createElement('div');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    signaturesSection.style.display = 'flex';
    signaturesSection.style.justifyContent = 'space-between';
    signaturesSection.style.width = '100%';
    signaturesSection.style.marginTop = '10px';
    signaturesSection.style.marginBottom = '20px';
    signaturesSection.style.padding = '0 20px';

    const signatureStyle = `
      padding-top: 5px;
      text-align: center;
      width: 180px;
    `;

    // Buscar assinaturas do Supabase
    const { data: controladorData } = await supabase
      .from('signatures')
      .select('*')
      .eq('signature_type', 'controlador')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: tecnicoData } = await supabase
      .from('signatures')
      .select('*')
      .eq('signature_type', 'tecnico')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    signaturesSection.innerHTML = `
      <div style="flex: 1; max-width: 180px;">
        <div style="${signatureStyle}">
          ${controladorData?.controlador_signature ? `<img src="${controladorData.controlador_signature}" alt="Assinatura" style="width: 180px; height: 60px; margin-bottom: 5px; display: block;">` : `<div style="width: 180px; height: 60px; margin-bottom: 5px; display: block;"></div>`}
          <div style="font-weight: bold; margin-top: 5px;">Controlador De Pragas</div>
          ${controladorData?.controlador_name ? `<div style="font-size: 11px; margin-top: 2px;">${controladorData.controlador_name}</div>` : ''}
          ${controladorData?.controlador_phone ? `<div style=\"font-size: 11px; margin-top: 2px;\">${controladorData.controlador_phone}</div>` : ''}
          ${controladorData?.controlador_email ? `<div style=\"font-size: 11px; margin-top: 2px;\">${controladorData.controlador_email}</div>` : ''}
        </div>
      </div>
      <div style="flex: 1; max-width: 180px;">
        <div style="${signatureStyle}">
          ${tecnicoData?.responsavel_tecnico_signature ? `<img src="${tecnicoData.responsavel_tecnico_signature}" alt="Assinatura" style="width: 180px; height: 60px; margin-bottom: 5px; display: block;">` : `<div style="width: 180px; height: 60px; margin-bottom: 5px; display: block;"></div>`}
          <div style="font-weight: bold; margin-top: 5px;">Responsável Técnico</div>
          ${tecnicoData?.responsavel_tecnico_name ? `<div style="font-size: 11px; margin-top: 2px;">${tecnicoData.responsavel_tecnico_name}</div>` : ''}
          ${tecnicoData?.responsavel_tecnico_crea ? `<div style=\"font-size: 11px; margin-top: 2px;\">CREA ${tecnicoData.responsavel_tecnico_crea}</div>` : ''}
          ${tecnicoData?.responsavel_tecnico_phone ? `<div style=\"font-size: 11px; margin-top: 2px;\">${tecnicoData.responsavel_tecnico_phone}</div>` : ''}
          ${tecnicoData?.responsavel_tecnico_email ? `<div style=\"font-size: 11px; margin-top: 2px;\">${tecnicoData.responsavel_tecnico_email}</div>` : ''}
        </div>
      </div>
      <div style="flex: 1; max-width: 180px;">
        <div style="${signatureStyle}">
          ${clientData?.signature ? `<img src="${clientData.signature}" alt="Assinatura" style="width: 180px; height: 60px; margin-bottom: 5px; display: block;">` : `<div style="width: 180px; height: 60px; margin-bottom: 5px; display: block;"></div>`}
          <div style="font-weight: bold; margin-top: 5px;">Contato Do Cliente</div>
          ${clientData?.contato ? `<div style="font-size: 11px; margin-top: 2px;">${clientData.contato}</div>` : ''}
        </div>
      </div>
    `;
    complementarySection.appendChild(signaturesSection);

    // Seção de resumo de contagem de pragas
    let pestCountSection = null;
    console.log('Dados de contagem de pragas recebidos no PDF:', serviceData.pestCounts);
    
    // Verificar se existem dados de contagem de pragas no localStorage
    // Tenta buscar usando diferentes chaves possíveis para garantir compatibilidade
    const possibleKeys = ['pestCounts', 'safeprag_pest_counts', 'pest_counts', 'pest_count_data', 'safeprag_pest_count_data'];
    let localPestCounts = null;
    
    for (const key of possibleKeys) {
      const pestCountsStr = localStorage.getItem(key);
      if (pestCountsStr) {
        try {
          localPestCounts = JSON.parse(pestCountsStr);
          // Se existem dados no localStorage e não foram passados via serviceData, usá-los
          if (localPestCounts && (!serviceData.pestCounts || serviceData.pestCounts.length === 0)) {
            serviceData.pestCounts = localPestCounts;
            console.log(`Usando dados de contagem de pragas do localStorage (chave: ${key}):`, localPestCounts);
            break; // Encontrou dados válidos, sai do loop
          }
        } catch (error) {
          console.error(`Erro ao parsear dados de contagem de pragas (chave: ${key}):`, error);
        }
      }
    }
    
    // Verificar se há dados de contagem de pragas na ordem de serviço ativa
    const activeOrderStr = localStorage.getItem('active_service_order');
    if (activeOrderStr && (!serviceData.pestCounts || serviceData.pestCounts.length === 0)) {
      try {
        const activeOrder = JSON.parse(activeOrderStr);
        if (activeOrder && activeOrder.pestCounts && activeOrder.pestCounts.length > 0) {
          serviceData.pestCounts = activeOrder.pestCounts;
          console.log('Usando dados de contagem de pragas da ordem de serviço ativa:', activeOrder.pestCounts);
        }
      } catch (error) {
        console.error('Erro ao parsear dados da ordem de serviço ativa:', error);
      }
    }
    
    // Verificar se há dados de contagem de pragas nos serviços ativos
    const pestCountsOrdersStr = localStorage.getItem(SERVICE_ORDERS_KEY);
    if (pestCountsOrdersStr && (!serviceData.pestCounts || serviceData.pestCounts.length === 0)) {
      try {
        const serviceOrders = JSON.parse(pestCountsOrdersStr);
        const activeOrder = serviceOrders.find((order: any) => order.status === 'in_progress');
        if (activeOrder && activeOrder.pestCounts && activeOrder.pestCounts.length > 0) {
          serviceData.pestCounts = activeOrder.pestCounts;
          console.log('Usando dados de contagem de pragas da ordem de serviço em andamento:', activeOrder.pestCounts);
        } else {
          // Verificar se há alguma ordem com dados de contagem de pragas
          const orderWithPestCounts = serviceOrders.find((order: any) => order.pestCounts && order.pestCounts.length > 0);
          if (orderWithPestCounts) {
            serviceData.pestCounts = orderWithPestCounts.pestCounts;
            console.log('Usando dados de contagem de pragas de outra ordem de serviço:', orderWithPestCounts.pestCounts);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados de contagem de pragas das ordens de serviço:', error);
      }
    }
    
    // Log para verificar os dados de contagem de pragas antes de criar a tabela
    console.log('Dados de contagem de pragas antes de criar a tabela:', JSON.stringify(serviceData.pestCounts || []));
    
    // Se ainda não tiver dados de contagem de pragas, verificar se há dados no formato antigo
    if (!serviceData.pestCounts || serviceData.pestCounts.length === 0) {
      const oldFormatPestCountsStr = localStorage.getItem('pest_counts_data');
      if (oldFormatPestCountsStr) {
        try {
          const oldFormatPestCounts = JSON.parse(oldFormatPestCountsStr);
          if (oldFormatPestCounts && Array.isArray(oldFormatPestCounts)) {
            // Converter formato antigo para o novo formato
            serviceData.pestCounts = oldFormatPestCounts.map((item, index) => ({
              deviceType: 'Armadilha',
              deviceNumber: index + 1,
              pests: Object.entries(item).map(([name, count]) => ({
                name,
                count: Number(count)
              })).filter(pest => pest.count > 0)
            })).filter(device => device.pests.length > 0);
            
            console.log('Convertendo dados de contagem de pragas do formato antigo:', serviceData.pestCounts);
          }
        } catch (error) {
          console.error('Erro ao parsear dados de contagem de pragas no formato antigo:', error);
        }
      }
    }
    
    // Criar seção de contagem de pragas por dispositivo SOMENTE se houver pragas com contagem > 0
    let hasPestsWithCount = false;
    
    if (serviceData.pestCounts && serviceData.pestCounts.length > 0) {
      console.log('Processando dados de contagem de pragas para o PDF...');
      
      // Verificar se há pelo menos um dispositivo com pragas contadas
      for (const device of serviceData.pestCounts) {
        if (device.pests && device.pests.some(pest => pest.count > 0)) {
          hasPestsWithCount = true;
          break;
        }
      }
      
      // Criar a seção SOMENTE se houver pragas com contagem > 0
      if (hasPestsWithCount) {
        pestCountSection = document.createElement('div');
        pestCountSection.className = 'section-container';
        pestCountSection.style.marginTop = '20px';
      
        // Título da seção
        const pestCountTitle = document.createElement('div');
        pestCountTitle.style.backgroundColor = '#1a73e8';
        pestCountTitle.style.color = 'white';
        pestCountTitle.style.padding = '5px 10px';
        pestCountTitle.style.marginBottom = '10px';
        pestCountTitle.innerHTML = 'Contagem de Pragas por Dispositivo';
        pestCountSection.appendChild(pestCountTitle);
        
        // Tabela de contagem de pragas
        const pestCountTable = document.createElement('table');
        pestCountTable.style.width = '100%';
        pestCountTable.style.borderCollapse = 'collapse';
        pestCountTable.style.fontSize = '10px';
        pestCountTable.style.marginBottom = '10px';
        
        // Cabeçalho da tabela
        let tableHeader = '<thead><tr style="background-color: #1a73e8; color: white;">';
        tableHeader += '<th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Tipo de Dispositivo</th>';
        tableHeader += '<th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Número Dispositivo</th>';
        tableHeader += '<th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Tipo de Praga</th>';
        tableHeader += '<th style="padding: 3px; text-align: center; border: 1px solid #ddd;">Quantidade</th>';
        tableHeader += '</tr></thead>';
        
        // Corpo da tabela
        let tableBody = '<tbody>';
        
        // Processar diretamente os dados de contagem de pragas sem agrupamento
        serviceData.pestCounts.forEach(device => {
          if (device.pests && device.pests.length > 0) {
            const pestsWithCount = device.pests.filter(pest => pest.count > 0);
            
            if (pestsWithCount.length > 0) {
              // Criar uma linha para cada tipo de praga encontrada no dispositivo
              pestsWithCount.forEach((pest, index) => {
                tableBody += '<tr>';
                
                // Apenas na primeira linha de cada dispositivo, mostrar o tipo e número
                if (index === 0) {
                  tableBody += `<td style="padding: 3px; border: 1px solid #ddd; text-align: center;" rowspan="${pestsWithCount.length}">${device.deviceType || 'Armadilha'}</td>`;
                  tableBody += `<td style="padding: 3px; border: 1px solid #ddd; text-align: center;" rowspan="${pestsWithCount.length}">${device.deviceNumber}</td>`;
                }
                
                // Mostrar o nome da praga e sua quantidade em colunas separadas
                tableBody += `<td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${pest.name}</td>`;
                tableBody += `<td style="padding: 3px; border: 1px solid #ddd; text-align: center;">${pest.count}</td>`;
                
                tableBody += '</tr>';
              });
            }
          }
        });
        
        tableBody += '</tbody>';
        pestCountTable.innerHTML = tableHeader + tableBody;
        pestCountSection.appendChild(pestCountTable);
        
        // Log para debug da tabela de contagem de pragas
        console.log('Tabela de contagem de pragas gerada com sucesso:', pestCountTable.innerHTML);
        console.log('Dados de contagem de pragas processados:', serviceData.pestCounts);
      }
    }
    
    // Log para debug da tabela de contagem de pragas
    console.log('Tabela de contagem de pragas gerada:', serviceData.pestCounts || []);
    console.log('Seção de contagem de pragas criada:', !!pestCountSection);
    console.log('Há pragas com contagem > 0:', hasPestsWithCount);
    
    // Montar o conteúdo do relatório com containers de seção
    // Primeiro, criar um array com as seções para facilitar a manipulação
    const reportSections = [
      `<div class="section-container">
        ${header.outerHTML}
        ${licensesContainer.outerHTML}
        ${divider.outerHTML}
        ${clientSection.outerHTML}
      </div>`,
      `<div class="section-container">
        ${serviceSection.outerHTML}
        ${servicesInfoSection.outerHTML}
        ${serviceTable.outerHTML}
      </div>`
    ];
    
    // Adicionar seção de dispositivos se existir
    if (devicesSection) {
      reportSections.push(`<div class="section-container">
        ${devicesSection.outerHTML}
      </div>`);
    }
    
    // Adicionar a seção de contagem de pragas ao relatório SOMENTE se houver pragas com contagem > 0
    if (pestCountSection && hasPestsWithCount) {
      reportSections.push(`<div class="section-container">
        ${pestCountSection.outerHTML}
      </div>`);
      console.log('Seção de contagem de pragas adicionada ao relatório');
    } else {
      console.log('Seção de contagem de pragas não adicionada ao relatório: não há pragas com contagem positiva');
    }
    
    // Adicionar seção complementar
    reportSections.push(`<div class="section-container">
      ${complementarySection.outerHTML}
    </div>`);
    
    // Juntar todas as seções
    reportElement.innerHTML = reportSections.join('\n');
    
    // Log para verificar se a seção de contagem de pragas foi adicionada
    console.log('Seções do relatório:', reportSections.length, 'incluindo contagem de pragas:', !!pestCountSection);
    
    // Log para debug da estrutura final do relatório
    console.log('Estrutura do relatório PDF com tabela de contagem de pragas forçada:', reportElement.innerHTML);
    
    // Log para debug da estrutura final do relatório
    console.log('Estrutura do relatório PDF:', {
      hasDevicesSection: !!devicesSection,
      hasPestCountSection: !!pestCountSection,
      pestCountsData: serviceData.pestCounts
    });

    // Opções do PDF
    const pdfOptions = {
      margin: [10, 10, 10, 10],
      filename: `ordem-servico-${serviceData.orderNumber}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 794 // A4 width in pixels at 96 DPI
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      }
    };

    // Gerar o PDF
    const pdf = await html2pdf()
      .set(pdfOptions)
      .from(reportElement)
      .toPdf()
      .get('pdf');
      
    // Limpa os dados retroativos após gerar o PDF
    localStorage.removeItem('retroactive_service_data');

    // Adicionar numeração de páginas no canto inferior direito
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.text(
        `${i}/${totalPages}`,
        pageWidth - 12,
        pageHeight - 8,
        { align: 'right' }
      );
    }

    // Salva no localStorage
    const pdfBlob = pdf.output('blob');
    storeServiceOrderPDF(pdfBlob, serviceData);

    // Retornar o blob do PDF
    return pdfBlob;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};

export const saveClientSignature = async (orderId: string, clientInfo: {
  name: string;
  phone: string;
  emails: string[];
  signature: string;
}) => {
  try {
    const savedOrders = localStorage.getItem('serviceOrders');
    if (!savedOrders) return;

    const orders = JSON.parse(savedOrders);
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const updatedOrder = {
          ...order,
          clientInfo: {
            name: clientInfo.name,
            phone: clientInfo.phone,
            emails: clientInfo.emails,
            signature: clientInfo.signature,
            timestamp: new Date().toISOString()
          }
        };
        return updatedOrder;
      }
      return order;
    });

    localStorage.setItem('serviceOrders', JSON.stringify(updatedOrders));
    return true;
  } catch (error) {
    console.error('Erro ao salvar assinatura:', error);
    throw error;
  }
};

export const updateClientSignature = async (orderId: string, clientInfo: {
  name: string;
  phone: string;
  emails: string[];
  signature: string;
}) => {
  try {
    const savedOrders = localStorage.getItem('serviceOrders');
    if (!savedOrders) return;

    const orders = JSON.parse(savedOrders);
    const updatedOrders = orders.map(order => {
      if (order.id === orderId) {
        const updatedOrder = {
          ...order,
          clientInfo: {
            name: clientInfo.name,
            contact: clientInfo.phone,
            email: clientInfo.emails.join(', '),
            signature: clientInfo.signature
          }
        };
        return updatedOrder;
      }
      return order;
    });

    localStorage.setItem('serviceOrders', JSON.stringify(updatedOrders));
    return true;
  } catch (error) {
    console.error('Erro ao atualizar assinatura:', error);
    throw error;
  }
}