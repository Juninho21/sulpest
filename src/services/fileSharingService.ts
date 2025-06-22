import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Toast } from '@capacitor/toast';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface FileSharingOptions {
  filename: string;
  data?: string; // Base64 data (opcional)
  orderNumber?: string; // Para buscar do localStorage
  mimeType?: string;
}

class FileSharingService {
  private isAndroid = Capacitor.getPlatform() === 'android';

  /**
   * Obtém dados do PDF do localStorage
   */
  private getPDFFromStorage(orderNumber: string): string | null {
    try {
      const storedPDFs = JSON.parse(localStorage.getItem('safeprag_service_order_pdfs') || '{}');
      const pdfData = storedPDFs[orderNumber];
      return pdfData ? pdfData.pdf : null;
    } catch (error) {
      console.error('Erro ao obter PDF do storage:', error);
      return null;
    }
  }

  /**
   * Salva arquivo temporariamente no sistema de arquivos
   */
  private async saveFileTemporarily(filename: string, data: string): Promise<string | null> {
    try {
      console.log('Salvando arquivo temporariamente:', filename);
      
      // Limpar nome do arquivo
      const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Tentar salvar em diferentes diretórios
      const directories = [
        Directory.Cache,
        Directory.Documents,
        Directory.Data
      ];
      
      for (const directory of directories) {
        try {
          console.log(`Tentando salvar em ${directory}...`);
          
          const result = await Filesystem.writeFile({
            path: cleanFilename,
            data: data,
            directory: directory,
            recursive: true
          });
          
          console.log(`Arquivo salvo com sucesso em ${directory}:`, result.uri);
          return result.uri;
          
        } catch (dirError) {
          console.log(`Erro ao salvar em ${directory}:`, dirError);
          continue;
        }
      }
      
      console.error('Falha ao salvar arquivo em todos os diretórios');
      return null;
      
    } catch (error) {
      console.error('Erro ao salvar arquivo temporariamente:', error);
      return null;
    }
  }

  /**
   * Compartilha arquivo via intent nativo do Android
   */
  async shareFile(options: FileSharingOptions): Promise<boolean> {
    try {
      console.log('Iniciando compartilhamento de arquivo:', options.filename);
      console.log('Plataforma:', Capacitor.getPlatform());
      
      // Limpar o nome do arquivo para evitar caracteres inválidos
      const cleanFilename = options.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      console.log('Nome do arquivo limpo:', cleanFilename);
      
      // Se temos orderNumber, busca do localStorage
      let pdfData = options.data;
      if (options.orderNumber && !pdfData) {
        console.log('Buscando PDF do localStorage para ordem:', options.orderNumber);
        const storedData = this.getPDFFromStorage(options.orderNumber);
        if (!storedData) {
          console.error('PDF não encontrado no localStorage');
          await this.showToast('PDF não encontrado no armazenamento');
          return false;
        }
        pdfData = storedData;
      }

      if (!pdfData) {
        console.error('Dados do arquivo não fornecidos');
        await this.showToast('Dados do arquivo não fornecidos');
        return false;
      }

      console.log('Dados do PDF obtidos, tamanho:', pdfData.length);

      if (!this.isAndroid) {
        console.log('Executando no web, fazendo download direto');
        // Fallback para web - download direto
        await this.downloadFileWeb({
          filename: cleanFilename,
          data: pdfData,
          mimeType: options.mimeType || 'application/pdf'
        });
        return true;
      }

      console.log('Executando no Android, salvando arquivo temporariamente...');
      
      // Salvar arquivo temporariamente
      const fileUri = await this.saveFileTemporarily(cleanFilename, pdfData);
      
      if (!fileUri) {
        console.error('Falha ao salvar arquivo temporariamente');
        await this.showToast('Erro ao preparar arquivo para compartilhamento');
        return false;
      }

      console.log('Arquivo salvo temporariamente:', fileUri);
      
      // Tentar compartilhamento usando o URI do arquivo
      try {
        console.log('Tentando compartilhamento com URI do arquivo...');
        
        await Share.share({
          title: cleanFilename,
          text: `Compartilhando ${cleanFilename}`,
          url: fileUri,
          dialogTitle: 'Compartilhar arquivo'
        });
        
        console.log('Compartilhamento via Capacitor Share concluído');
        return true;
        
      } catch (shareError) {
        console.error('Erro no Capacitor Share com URI:', shareError);
        
        // Se falhar com URI, tentar com data URL como fallback
        console.log('Tentando compartilhamento com data URL como fallback...');
        
        try {
          const dataUrl = `data:${options.mimeType || 'application/pdf'};base64,${pdfData}`;
          
          await Share.share({
            title: cleanFilename,
            text: `Compartilhando ${cleanFilename}`,
            url: dataUrl,
            dialogTitle: 'Compartilhar arquivo'
          });
          
          console.log('Compartilhamento com data URL concluído');
          return true;
          
        } catch (dataUrlError) {
          console.error('Erro no compartilhamento com data URL:', dataUrlError);
          await this.showToast('Erro ao compartilhar arquivo: ' + dataUrlError);
          return false;
        }
      }

    } catch (error) {
      console.error('Erro detalhado ao compartilhar arquivo:', error);
      
      // Log mais específico do erro
      if (error instanceof Error) {
        console.error('Mensagem de erro:', error.message);
        console.error('Stack trace:', error.stack);
      }
      
      // Se tudo falhar, mostrar erro
      let errorMessage = 'Erro ao compartilhar arquivo';
      if (error instanceof Error) {
        if (error.message.includes('cancel')) {
          errorMessage = 'Compartilhamento cancelado';
        } else {
          errorMessage = 'Erro ao compartilhar arquivo: ' + error.message;
        }
      }
      
      await this.showToast(errorMessage);
      return false;
    }
  }

  /**
   * Compartilha PDF de uma ordem de serviço específica
   */
  async shareServiceOrderPDF(orderNumber: string): Promise<boolean> {
    return this.shareFile({
      filename: `OS_${orderNumber}.pdf`,
      orderNumber: orderNumber,
      mimeType: 'application/pdf'
    });
  }

  /**
   * Download direto para web (fallback)
   */
  private async downloadFileWeb(options: { filename: string; data: string; mimeType: string }): Promise<void> {
    const blob = this.base64ToBlob(options.data, options.mimeType);
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = options.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  /**
   * Converte base64 para Blob
   */
  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Mostra toast de mensagem
   */
  private async showToast(message: string): Promise<void> {
    try {
      if (this.isAndroid) {
        await Toast.show({
          text: message,
          duration: 'short',
          position: 'bottom'
        });
      } else {
        console.log('Toast:', message);
      }
    } catch (error) {
      console.log('Toast:', message);
    }
  }

  /**
   * Verifica se o compartilhamento é suportado
   */
  isSharingSupported(): boolean {
    return this.isAndroid || 'share' in navigator;
  }
}

export const fileSharingService = new FileSharingService(); 