import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { AdminTabs } from './AdminTabs';
import BackupMaintenance from './BackupMaintenance/BackupMaintenance';
import { ClientForm } from './ClientForm';
import { ProductForm } from './ProductForm';
import { ImageUpload } from './ImageUpload';
import { Shield, Trash2, RefreshCw, Database, Building2, Users, Package, User, Pen, Eye, X, Cloud } from 'lucide-react';
import { STORAGE_KEYS, backupAllData, restoreBackup } from '../services/storageKeys';
import { finishAllActiveServiceOrders, cleanupSystemData } from '../services/ordemServicoService';
import { companyService } from '../services/dataService';
import { Modal } from './Modal';
import DownloadsManagement from './ServiceOrders/DownloadsManagement';
import { Link } from 'react-router-dom';
import { MigrationTool } from './MigrationTool';
import { supabaseDataService } from '../services/supabaseDataService';
import { getSignaturesFromSupabase } from '../services/dataSyncService';
import { supabase } from '../config/supabase';

interface CompanyData {
  id?: number;
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  environmental_license: {
    number: string;
    date: string;
  };
  sanitary_permit: {
    number: string;
    expiry_date: string;
  };
  created_at?: string;
  updated_at?: string;
}

interface UserData {
  name: string;
  phone: string;
  email: string;
  signatureType: 'controlador' | 'tecnico';
  tecnicoName?: string;
  tecnicoCrea?: string;
  tecnicoPhone?: string;
  tecnicoEmail?: string;
  signature?: string;
  tecnicoSignature?: string;
}

const COMPANY_STORAGE_KEY = STORAGE_KEYS.COMPANY;

const emptyCompanyData: CompanyData = {
  name: '',
  cnpj: '',
  phone: '',
  email: '',
  address: '',
  logo_url: '',
  environmental_license: {
    number: '',
    date: ''
  },
  sanitary_permit: {
    number: '',
    expiry_date: ''
  }
};

export const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('empresa');
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  const [showSavedData, setShowSavedData] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData>(() => {
    const savedData = localStorage.getItem(STORAGE_KEYS.COMPANY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        return {
          ...emptyCompanyData,
          ...parsed,
          environmental_license: {
            ...emptyCompanyData.environmental_license,
            ...parsed.environmental_license
          },
          sanitary_permit: {
            ...emptyCompanyData.sanitary_permit,
            ...parsed.sanitary_permit
          }
        };
      } catch (error) {
        console.error('Erro ao carregar dados da empresa:', error);
        return emptyCompanyData;
      }
    }
    return emptyCompanyData;
  });
  const [userData, setUserData] = useState<UserData>(() => {
    const saved = localStorage.getItem('userData');
    return saved ? JSON.parse(saved) : { 
      name: '', 
      phone: '', 
      email: '', 
      signatureType: 'controlador',
      tecnicoName: '',
      tecnicoCrea: '',
      tecnicoPhone: '',
      tecnicoEmail: '',
      signature: undefined,
      tecnicoSignature: undefined,
    };
  });

  const canvasControladorRef = useRef<HTMLCanvasElement>(null);
  const canvasTecnicoRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingControlador, setIsDrawingControlador] = useState(false);
  const [lastControladorX, setLastControladorX] = useState(0);
  const [lastControladorY, setLastControladorY] = useState(0);
  const [isDrawingTecnico, setIsDrawingTecnico] = useState(false);
  const [lastTecnicoX, setLastTecnicoX] = useState(0);
  const [lastTecnicoY, setLastTecnicoY] = useState(0);

  const [isSignatureViewModalOpen, setIsSignatureViewModalOpen] = useState(false);
  const [signatureViewImageSrc, setSignatureViewImageSrc] = useState<string | undefined>(undefined);
  const [signatureViewTitle, setSignatureViewTitle] = useState('');

  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const supabaseData = await supabaseDataService.getCompany();
        if (supabaseData && supabaseData.logo_url) {
          // Se existe logo no Supabase, usa ele
          const formattedData = {
            ...emptyCompanyData,
            ...supabaseData,
            logo_url: supabaseData.logo_url,
            environmental_license: {
              ...emptyCompanyData.environmental_license,
              ...(supabaseData.environmental_license || {})
            },
            sanitary_permit: {
              ...emptyCompanyData.sanitary_permit,
              ...(supabaseData.sanitary_permit || {})
            }
          };
          setCompanyData(formattedData);
        } else {
          // Se não existe logo no Supabase, tenta carregar do localStorage
          const localData = localStorage.getItem(COMPANY_STORAGE_KEY);
          if (localData) {
            const parsed = JSON.parse(localData);
            setCompanyData({
              ...emptyCompanyData,
              ...parsed,
              environmental_license: {
                ...emptyCompanyData.environmental_license,
                ...(parsed.environmental_license || {})
              },
              sanitary_permit: {
                ...emptyCompanyData.sanitary_permit,
                ...(parsed.sanitary_permit || {})
              }
            });
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados da empresa:', error);
      }
    };
    loadCompanyData();
  }, []);

  useEffect(() => {
    if (activeTab === 'userData') {
      setUserData(prev => ({ ...prev, signatureType: 'controlador' }));
    }
  }, [activeTab]);

  useEffect(() => {
    // Carregar dados salvos quando a aba for aberta
    if (activeTab === 'userData') {
      const savedData = localStorage.getItem('userData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setUserData(prev => ({
          ...prev,
          ...parsedData,
          signatureType: prev.signatureType // Mantém o tipo selecionado
        }));
      }
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'usuarios') {
      // Carregar dados do Supabase para preencher o formulário de assinaturas
      const fetchSignatures = async () => {
        try {
          // Buscar assinatura do controlador
          const { data: controladorData } = await supabase
            .from('signatures')
            .select('*')
            .eq('signature_type', 'controlador')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Buscar assinatura do responsável técnico
          const { data: tecnicoData } = await supabase
            .from('signatures')
            .select('*')
            .eq('signature_type', 'tecnico')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          setUserData(prev => ({
            ...prev,
            // Dados do controlador
            name: controladorData?.controlador_name || '',
            phone: controladorData?.controlador_phone || '',
            email: controladorData?.controlador_email || '',
            signature: controladorData?.controlador_signature || '',
            // Dados do responsável técnico
            tecnicoName: tecnicoData?.responsavel_tecnico_name || '',
            tecnicoCrea: tecnicoData?.responsavel_tecnico_crea || '',
            tecnicoPhone: tecnicoData?.responsavel_tecnico_phone || '',
            tecnicoEmail: tecnicoData?.responsavel_tecnico_email || '',
            tecnicoSignature: tecnicoData?.responsavel_tecnico_signature || '',
          }));
        } catch (error) {
          toast.error('Erro ao carregar assinaturas do Supabase');
        }
      };
      fetchSignatures();
    }
  }, [activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyData.name || !companyData.cnpj || !companyData.phone || !companyData.address || !companyData.email) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    handleSave();
  };

  const handleSave = async () => {
    try {
      // Salvar no localStorage
      companyService.saveCompany(companyData);
      localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(companyData));

      // Preparar dados para o Supabase
      const supabaseData = {
        ...companyData,
        logo_url: companyData.logo_url,
        environmental_license_number: companyData.environmental_license.number,
        environmental_license_validity: companyData.environmental_license.date,
        sanitary_permit_number: companyData.sanitary_permit.number,
        sanitary_permit_validity: companyData.sanitary_permit.expiry_date
      };

      // Salvar no Supabase
      await supabaseDataService.saveCompany(supabaseData);
      
      toast.success('Dados da empresa salvos com sucesso!');
      setShowSavedData(true);
    } catch (error) {
      console.error('Erro ao salvar dados:', error);
      toast.error('Erro ao salvar dados da empresa');
    }
  };

  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja excluir os dados da empresa?')) {
      localStorage.removeItem(COMPANY_STORAGE_KEY);
      setCompanyData(emptyCompanyData);
      setCompanyLogo(null);
      setShowSavedData(false);
      toast.success('Dados da empresa excluídos com sucesso!');
    }
  };

  const handleLogoUpload = async (file: File) => {
    try {
      // Upload para o Supabase
      const newLogoUrl = await supabaseDataService.uploadCompanyLogo(file);
      
      // Atualizar o estado local
      setCompanyData(prev => ({
        ...prev,
        logo_url: newLogoUrl
      }));
      
      // Salvar no localStorage
      const updatedData = {
        ...companyData,
        logo_url: newLogoUrl
      };
      localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(updatedData));
      
      // Salvar no Supabase
      await supabaseDataService.saveCompany(updatedData);
      
      toast.success('Logo atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      toast.error('Erro ao processar imagem');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      if (parent === 'environmental_license') {
        setCompanyData(prev => ({
          ...prev,
          environmental_license: {
            ...prev.environmental_license,
            [child]: value
          }
        }));
      } else if (parent === 'sanitary_permit') {
        setCompanyData(prev => ({
          ...prev,
          sanitary_permit: {
            ...prev.sanitary_permit,
            [child]: value
          }
        }));
      }
    } else {
      setCompanyData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleBackup = () => {
    try {
      const backup = backupAllData();
      const backupStr = JSON.stringify(backup);
      const blob = new Blob([backupStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safeprag_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup realizado com sucesso!');
    } catch (error) {
      console.error('Erro ao fazer backup:', error);
      toast.error('Erro ao gerar backup');
    }
  };

  const handleRestore = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string);
        restoreBackup(backup);
        toast.success('Backup restaurado com sucesso!');
      } catch (error) {
        console.error('Erro ao restaurar backup:', error);
        toast.error('Erro ao restaurar backup');
      }
    };
    reader.readAsText(file);
  };

  const handleSaveControlador = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase
        .from('signatures')
        .upsert({
          signature_type: 'controlador',
          controlador_name: userData.name,
          controlador_phone: userData.phone,
          controlador_email: userData.email,
          controlador_signature: userData.signature,
          updated_at: new Date().toISOString(),
        }, { onConflict: ['signature_type'] });
      toast.success('Dados do Controlador salvos no Supabase!');
    } catch (error) {
      toast.error('Erro ao salvar dados do Controlador no Supabase');
    }
  };

  const handleSaveTecnico = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabase
        .from('signatures')
        .upsert({
          signature_type: 'tecnico',
          controlador_name: '-',
          responsavel_tecnico_name: userData.tecnicoName,
          responsavel_tecnico_crea: userData.tecnicoCrea,
          responsavel_tecnico_phone: userData.tecnicoPhone,
          responsavel_tecnico_email: userData.tecnicoEmail,
          responsavel_tecnico_signature: userData.tecnicoSignature,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'signature_type' });
      toast.success('Dados do Responsável Técnico salvos no Supabase!');
    } catch (error) {
      toast.error('Erro ao salvar dados do Responsável Técnico no Supabase');
    }
  };

  const handleSignatureTypeChange = (type: 'controlador' | 'tecnico') => {
    setUserData(prev => ({ ...prev, signatureType: type }));
  };

  const startDrawingControlador = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasControladorRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      e.preventDefault(); // Prevenir scroll em dispositivos touch
      const touch = e.touches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    setIsDrawingControlador(true);
    setLastControladorX(x);
    setLastControladorY(y);
  };

  const drawControlador = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingControlador || !canvasControladorRef.current) return;

    const canvas = canvasControladorRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      e.preventDefault(); // Prevenir scroll em dispositivos touch
      const touch = e.touches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.beginPath();
    ctx.moveTo(lastControladorX, lastControladorY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    setLastControladorX(x);
    setLastControladorY(y);
  };

  const startDrawingTecnico = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasTecnicoRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      e.preventDefault(); // Prevenir scroll em dispositivos touch
      const touch = e.touches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    setIsDrawingTecnico(true);
    setLastTecnicoX(x);
    setLastTecnicoY(y);
  };

  const drawTecnico = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingTecnico || !canvasTecnicoRef.current) return;

    const canvas = canvasTecnicoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let x, y;
    if ('touches' in e) {
      e.preventDefault(); // Prevenir scroll em dispositivos touch
      const touch = e.touches[0];
      x = (touch.clientX - rect.left) * scaleX;
      y = (touch.clientY - rect.top) * scaleY;
    } else {
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.beginPath();
    ctx.moveTo(lastTecnicoX, lastTecnicoY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    setLastTecnicoX(x);
    setLastTecnicoY(y);
  };

  const stopDrawingControlador = () => {
    if (isDrawingControlador && canvasControladorRef.current) {
      setIsDrawingControlador(false);
      const signatureData = canvasControladorRef.current.toDataURL();
      setUserData(prev => ({ ...prev, signature: signatureData }));
    }
  };

  const clearControladorSignature = () => {
    if (canvasControladorRef.current) {
      const ctx = canvasControladorRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasControladorRef.current.width, canvasControladorRef.current.height);
        setUserData(prev => ({ ...prev, signature: undefined }));
      }
    }
  };

  const stopDrawingTecnico = () => {
    if (isDrawingTecnico && canvasTecnicoRef.current) {
      setIsDrawingTecnico(false);
      const signatureData = canvasTecnicoRef.current.toDataURL();
      setUserData(prev => ({ ...prev, tecnicoSignature: signatureData }));
    }
  };

  const clearTecnicoSignature = () => {
    if (canvasTecnicoRef.current) {
      const ctx = canvasTecnicoRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasTecnicoRef.current.width, canvasTecnicoRef.current.height);
        setUserData(prev => ({ ...prev, tecnicoSignature: undefined }));
      }
    }
  };

  const handleViewSignature = (type: 'controlador' | 'tecnico') => {
    if (type === 'controlador' && userData.signature) {
      setSignatureViewImageSrc(userData.signature);
      setSignatureViewTitle('Assinatura do Controlador');
      setIsSignatureViewModalOpen(true);
    } else if (type === 'tecnico' && userData.tecnicoSignature) {
      setSignatureViewImageSrc(userData.tecnicoSignature);
      setSignatureViewTitle('Assinatura do Responsável Técnico');
      setIsSignatureViewModalOpen(true);
    } else {
      toast.info('Nenhuma assinatura salva para visualizar.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Configurações do Sistema</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção de Migração */}
        {/* <div className="col-span-1 md:col-span-2">
          <MigrationTool />
        </div> */}

        {/* Seção da Empresa */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-center">Empresa</h2>
          </div>
          
          <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="mt-4 sm:mt-6">
            {activeTab === 'empresa' && (
              <div className="bg-white shadow rounded-lg p-3 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="mb-6">
                    <ImageUpload 
                      onFileSelect={handleLogoUpload} 
                      currentImageUrl={"https://badyvhzrjbemyqzeqlaw.supabase.co/storage/v1/object/public/company/logos/logo.png"}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome da Empresa
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={companyData.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700 mb-1">
                        CNPJ
                      </label>
                      <input
                        type="text"
                        id="cnpj"
                        name="cnpj"
                        value={companyData.cnpj}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        Telefone
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={companyData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={companyData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                        Endereço
                      </label>
                      <input
                        type="text"
                        id="address"
                        name="address"
                        value={companyData.address}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Licença Ambiental */}
                  <div className="col-span-2 mt-4">
                    <h3 className="text-lg font-medium text-gray-700 mb-3">Licença Ambiental</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="environmentalLicenseNumber" className="block text-sm font-medium text-gray-700 mb-1">
                          Número da Licença Ambiental
                        </label>
                        <input
                          type="text"
                          id="environmentalLicenseNumber"
                          name="environmental_license.number"
                          value={companyData.environmental_license.number}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="environmentalLicenseDate" className="block text-sm font-medium text-gray-700 mb-1">
                          Validade da Licença Ambiental
                        </label>
                        <input
                          type="date"
                          id="environmentalLicenseDate"
                          name="environmental_license.date"
                          value={companyData.environmental_license.date}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Alvará Sanitário */}
                  <div className="col-span-2 mt-4">
                    <h3 className="text-lg font-medium text-gray-700 mb-3">Alvará Sanitário</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="sanitaryPermitNumber" className="block text-sm font-medium text-gray-700 mb-1">
                          Número do Alvará Sanitário
                        </label>
                        <input
                          type="text"
                          id="sanitaryPermitNumber"
                          name="sanitary_permit.number"
                          value={companyData.sanitary_permit.number}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="sanitaryPermitExpiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                          Validade do Alvará Sanitário
                        </label>
                        <input
                          type="date"
                          id="sanitaryPermitExpiryDate"
                          name="sanitary_permit.expiry_date"
                          value={companyData.sanitary_permit.expiry_date}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mt-6 space-x-3">
                    {showSavedData && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Excluir
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'clientes' && (
              <div className="bg-white shadow rounded-lg p-3 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Clientes</h2>
                <ClientForm />
              </div>
            )}

            {activeTab === 'produtos' && (
              <div className="bg-white shadow rounded-lg p-3 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Produtos</h2>
                <ProductForm />
              </div>
            )}

            {activeTab === 'usuarios' && (
              <div className="bg-white shadow rounded-lg p-3 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Usuários</h2>
                <div className="space-y-8">
                  <div className="space-y-4 max-w-2xl">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tipo de Usuário/Assinatura
                        </label>
                        <select
                          value={userData.signatureType}
                          onChange={(e) => {
                            handleSignatureTypeChange(e.target.value as 'controlador' | 'tecnico');
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="controlador">Controlador de pragas</option>
                          <option value="tecnico">Responsável técnico</option>
                        </select>
                      </div>

                      {userData.signatureType === 'controlador' && (
                        <form onSubmit={handleSaveControlador} className="border border-gray-200 rounded-lg p-4 space-y-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Dados do Controlador de Pragas
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome do Controlador de Pragas
                              </label>
                              <input
                                type="text"
                                value={userData.name}
                                onChange={(e) => setUserData((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone do Controlador de pragas
                              </label>
                              <input
                                type="tel"
                                value={userData.phone}
                                onChange={(e) => setUserData((prev) => ({ ...prev, phone: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                E-mail do controlador de pragas
                              </label>
                              <input
                                type="email"
                                value={userData.email}
                                onChange={(e) => setUserData((prev) => ({ ...prev, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Assinatura do controlador de pragas
                              </label>
                              <div className="border border-gray-300 rounded-md p-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm text-gray-500">
                                    <Pen className="inline-block w-4 h-4 mr-1" />
                                    Desenhe sua assinatura abaixo
                                  </span>
                                  <div className="flex space-x-2">
                                    {userData.signature && (
                                      <button
                                        type="button"
                                        onClick={() => handleViewSignature('controlador')}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                                      >
                                        <Eye className="w-4 h-4 mr-1" /> Visualizar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={clearControladorSignature}
                                      className="text-sm text-red-600 hover:text-red-700 flex items-center"
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" /> Limpar
                                    </button>
                                  </div>
                                </div>
                                <canvas
                                  ref={canvasControladorRef}
                                  width={400}
                                  height={200}
                                  onMouseDown={startDrawingControlador}
                                  onMouseMove={drawControlador}
                                  onMouseUp={stopDrawingControlador}
                                  onMouseOut={stopDrawingControlador}
                                  onTouchStart={startDrawingControlador}
                                  onTouchMove={drawControlador}
                                  onTouchEnd={stopDrawingControlador}
                                  className="border border-gray-200 rounded w-full bg-white cursor-crosshair"
                                  style={{ touchAction: 'none' }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              Salvar Dados do Controlador
                            </button>
                          </div>
                        </form>
                      )}

                      {userData.signatureType === 'tecnico' && (
                        <form onSubmit={handleSaveTecnico} className="border border-gray-200 rounded-lg p-4 space-y-4">
                          <h3 className="text-lg font-medium text-gray-900 mb-4">
                            Dados do Responsável Técnico
                          </h3>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nome do Responsável Técnico
                              </label>
                              <input
                                type="text"
                                value={userData.tecnicoName}
                                onChange={(e) => setUserData((prev) => ({ ...prev, tecnicoName: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                CREA
                              </label>
                              <input
                                type="text"
                                value={userData.tecnicoCrea}
                                onChange={(e) => setUserData((prev) => ({ ...prev, tecnicoCrea: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Telefone do Responsável Técnico
                              </label>
                              <input
                                type="tel"
                                value={userData.tecnicoPhone}
                                onChange={(e) => setUserData((prev) => ({ ...prev, tecnicoPhone: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                E-mail do Responsável Técnico
                              </label>
                              <input
                                type="email"
                                value={userData.tecnicoEmail}
                                onChange={(e) => setUserData((prev) => ({ ...prev, tecnicoEmail: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Assinatura do Respnsável Técnico
                              </label>
                              <div className="border border-gray-300 rounded-md p-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm text-gray-500">
                                    <Pen className="inline-block w-4 h-4 mr-1" />
                                    Desenhe sua assinatura abaixo
                                  </span>
                                  <div className="flex space-x-2">
                                    {userData.tecnicoSignature && (
                                      <button
                                        type="button"
                                        onClick={() => handleViewSignature('tecnico')}
                                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                                      >
                                        <Eye className="w-4 h-4 mr-1" /> Visualizar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={clearTecnicoSignature}
                                      className="text-sm text-red-600 hover:text-red-700 flex items-center"
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" /> Limpar
                                    </button>
                                  </div>
                                </div>
                                <canvas
                                  ref={canvasTecnicoRef}
                                  width={400}
                                  height={200}
                                  onMouseDown={startDrawingTecnico}
                                  onMouseMove={drawTecnico}
                                  onMouseUp={stopDrawingTecnico}
                                  onMouseOut={stopDrawingTecnico}
                                  onTouchStart={startDrawingTecnico}
                                  onTouchMove={drawTecnico}
                                  onTouchEnd={stopDrawingTecnico}
                                  className="border border-gray-200 rounded w-full bg-white cursor-crosshair"
                                  style={{ touchAction: 'none' }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            >
                              Salvar Dados do Técnico
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'downloads' && (
              <div className="bg-white shadow rounded-lg p-3 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Downloads</h2>
                <DownloadsManagement />
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="bg-white shadow rounded-lg p-3 sm:p-6">
                <BackupMaintenance />
              </div>
            )}
          </div>
        </div>

        {/* Seção de Usuário */}
        <div className="bg-white shadow rounded-lg p-6">
          {/* ... existing code ... */}
        </div>
      </div>
      
      {/* Modal de Visualização da Assinatura */}
      <Modal
        isOpen={isSignatureViewModalOpen}
        onRequestClose={() => setIsSignatureViewModalOpen(false)}
        className="modal-content"
        overlayClassName="modal-overlay"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">{signatureViewTitle}</h2>
            <button
              onClick={() => setIsSignatureViewModalOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex justify-center">
            {signatureViewImageSrc ? (
              <img 
                src={signatureViewImageSrc} 
                alt="Assinatura Salva" 
                style={{ maxWidth: '100%', maxHeight: '400px', background: 'white' }}
                className="border border-gray-200 rounded"
              />
            ) : (
              <p>Nenhuma assinatura disponível.</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
