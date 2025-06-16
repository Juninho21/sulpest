import React, { useState, useEffect, useReducer, useRef, useCallback } from 'react';
import { 
  Calendar, 
  Settings,
  ClipboardList,
  Activity,
  Download,
  CheckCircle,
  ThumbsUp
} from 'lucide-react';
import { ServiceScheduler } from './components/ServiceScheduler';
import { BottomNavBar } from './components/BottomNavBar';
import { AdminPage } from './components/AdminPage';
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationToast } from './components/NotificationToast';
import { KeepAliveProvider } from './contexts/KeepAliveContext';
import { useNotification } from './contexts/NotificationContext';
import { ApprovalModal } from './components/ApprovalModal';
import ServiceActivity from './components/ServiceActivity';
import { storageService } from './services/storageService';
import { generateServiceOrderPDF } from './services/pdfService';
import { getActiveServiceOrder, approveServiceOrder, updateScheduleStatus } from './services/ordemServicoService';
import { loadAllDataFromSupabase } from './services/dataSyncService';
import { useSupabase } from './hooks/useSupabase';
import { toast } from 'react-toastify';

interface State {
  selectedDevice: string;
  selectedStatus: string;
  quantity: string;
  devices: Array<{
    id: string;
    type: string;
    status: string | null;
    quantity?: string;
  }>;
  savedDevices: Array<{
    id: string;
    type: string;
    status: string;
    quantity?: string;
  }>;
  isLoading: boolean;
  startTime: Date | null;
  endTime: Date | null;
  selectedProduct: {
    name: string;
    activeIngredient: string;
    chemicalGroup: string;
    registration: string;
    batch: string;
    validity: string;
    quantity: string;
    dilution: string;
  } | null;
  serviceOrders: Array<{
    id: string;
    createdAt: string;
    updatedAt: string;
    status: 'in_progress' | 'completed' | 'cancelled' | 'approved';
    devices: Array<{
      id: string;
      type: string;
      status: string;
      quantity?: string;
    }>;
    pdfUrl: string;
    client: {
      code: string;
      name: string;
      address: string;
    };
  }>;
  observations: string;
  location: string;
  selectedOs: any;
  counter: number;
  currentPage: string;
}

interface Product {
  name: string;
  activeIngredient: string;
  chemicalGroup: string;
  registration: string;
  batch: string;
  validity: string;
  quantity: string;
  dilution: string;
}

type Action =
  | { type: 'SET_DEVICE'; payload: string }
  | { type: 'SET_STATUS'; payload: string }
  | { type: 'SET_QUANTITY'; payload: string }
  | { type: 'SET_DEVICES'; payload: Array<{
    id: string;
    type: string;
    status: string;
    quantity?: string;
  }> }
  | { type: 'UPDATE_DEVICE'; payload: { id: string; status: string | null } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SAVE_DEVICES' }
  | { type: 'CLEAR_CURRENT' }
  | { type: 'RESET' }
  | { type: 'SET_PAGE'; payload: string }
  | { type: 'SET_SELECTED_PRODUCT'; payload: Product | null }
  | { type: 'CLEAR_SELECTED_PRODUCT' }
  | { 
      type: 'ADD_SERVICE_ORDER'; 
      payload: { 
        devices: Array<{
          id: string;
          type: string;
          status: string;
          quantity?: string;
        }>;
        pdfUrl: string;
        client: {
          code: string;
          name: string;
          address: string;
        };
        service: {
          type: string;
          target: string;
          location: string;
        };
        product: Product;
        observations: string;
        startTime: string;
        endTime: string;
        signatures: {
          serviceResponsible: string;
          technicalResponsible: string;
          clientRepresentative: string;
        };
      } 
    }
  | { type: 'SET_START_TIME'; payload: Date }
  | { type: 'SET_END_TIME'; payload: Date };

const initialState: State = {
  selectedDevice: '',
  selectedStatus: '',
  quantity: '',
  devices: [],
  savedDevices: [],
  isLoading: false,
  startTime: null,
  endTime: null,
  selectedProduct: null,
  serviceOrders: [],
  observations: '',
  location: '',
  selectedOs: null,
  counter: 0,
  currentPage: 'home',
};

export const STATUS_TYPES = [
  'Conforme',
  'Sem Dispositivo',
  'Dispositivo danificado',
  'Consumida',
  'Sem acesso',
  'Desarmada',
  'Desligada',
  'Praga encontrada'
] as const;

interface ServiceData {
  clientName: string;
  clientCode: string;
  serviceType: string;
  date: string;
  time: string;
  status: string;
  productsUsed: string;
  endTime?: string;
  signatures?: {
    serviceResponsible: string;
    technicalResponsible: string;
    clientRepresentative: string;
  };
  pestCounts?: {
    deviceType: string;
    deviceNumber: number;
    pests: {
      name: string;
      count: number;
    }[];
  }[];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_DEVICE':
      return { ...state, selectedDevice: action.payload };
    case 'SET_STATUS':
      return { ...state, selectedStatus: action.payload };
    case 'SET_QUANTITY':
      return { ...state, quantity: action.payload };
    case 'SET_DEVICES':
      return { ...state, devices: action.payload };
    case 'UPDATE_DEVICE':
      return {
        ...state,
        devices: state.devices.map(device =>
          device.id === action.payload.id
            ? { ...device, status: action.payload.status } as any
            : device
        )
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SAVE_DEVICES':
      return {
        ...state,
        savedDevices: [...state.savedDevices, ...state.devices],
      };
    case 'CLEAR_CURRENT':
      return {
        ...state,
        selectedDevice: '',
        selectedStatus: '',
        quantity: '',
        devices: [],
      };
    case 'RESET':
      return {
        ...state,
        selectedDevice: '',
        selectedStatus: '',
        quantity: '',
        devices: [],
        savedDevices: [],
        isLoading: false
      };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_SELECTED_PRODUCT':
      return { ...state, selectedProduct: action.payload };
    case 'CLEAR_SELECTED_PRODUCT':
      return { ...state, selectedProduct: null };
    case 'ADD_SERVICE_ORDER':
      return {
        ...state,
        serviceOrders: [
          ...state.serviceOrders,
          {
            id: state.serviceOrders.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'completed',
            devices: action.payload.devices,
            pdfUrl: action.payload.pdfUrl,
            client: action.payload.client,
            service: action.payload.service,
            product: action.payload.product,
            observations: action.payload.observations,
            startTime: action.payload.startTime,
            endTime: action.payload.endTime,
            signatures: action.payload.signatures
          }
        ],
        savedDevices: [],
        devices: [],
        selectedDevice: '',
        selectedStatus: '',
        quantity: '',
        currentPage: 'stats'
      };
    case 'SET_START_TIME':
      return {
        ...state,
        startTime: action.payload,
        isLoading: false
      };
    case 'SET_END_TIME':
      return {
        ...state,
        endTime: action.payload,
        isLoading: false
      };
    default:
      return state;
  }
}

// Interface para Device no contexto do storageService
interface StorageDevice {
  id: string;
  type: string;
  status: string; // storageService pode esperar string aqui
  quantity?: string;
  number?: number; // Adicionar number como opcional
  pests?: any[]; // Adicionar pests como opcional
}

// Interface para ServiceOrder no contexto do storageService e ADD_SERVICE_ORDER
interface ServiceOrder {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'approved';
  devices: Array<{
    id: string;
    type: string;
    status: string; // A interface pode esperar string aqui
    quantity?: string;
  }>;
  pdfUrl: string;
  client: {
    code: string;
    name: string;
    address: string;
    // Adicionar outros campos do cliente se necessário e se existirem na interface real
    // document?: string;
    // contact?: string;
    // phone?: string;
    // branch?: string;
  };
  observations: string;
  // As propriedades abaixo parecem não existir diretamente na interface ServiceOrder original
  // service?: any;
  // product?: any;
  // startTime?: string;
  // endTime?: string;
  // signatures?: any;
}

// Interface para ServiceData usada em handleGenerateServiceOrder
interface ServiceDataForPDF {
  clientName: string;
  clientCode: string;
  serviceType: string;
  date: string;
  time: string;
  status: string;
  productsUsed: string; // Esta prop parece ter um propósito diferente e pode não ser usada para gerar a tabela de produtos
  endTime?: string;
  signatures?: { // Definir estrutura de signatures
    serviceResponsible: string;
    technicalResponsible: string;
    clientRepresentative: string;
  };
  pestCounts?: { // Definir estrutura de pestCounts
    deviceType: string;
    deviceNumber: number;
    pests: { name: string; count: number; }[];
  }[];
  // Adicionar outros campos necessários para generateServiceOrderPDF
  client: any; // Usar any temporariamente ou definir a estrutura completa
  services?: any[]; // Adicionar services
  service?: any; // Adicionar service
  product?: any; // Adicionar product
  startTime?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState('schedule');
  const [state, dispatch] = useReducer(reducer, initialState);
  const [serviceType, setServiceType] = useState('');
  const [location, setLocation] = useState('');
  const [observations, setObservations] = useState('');
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [productAmount, setProductAmount] = useState('');
  const [productUnit, setProductUnit] = useState('ml');
  const [applicationMethod, setApplicationMethod] = useState('');
  const [targetPest, setTargetPest] = useState('');
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useNotification();
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const { isConnected } = useSupabase();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Salvar devices quando houver mudanças
    storageService.saveDevices(state.devices);
  }, [state.devices]);

  useEffect(() => {
    // Salvar service orders quando houver mudanças
    storageService.saveServiceOrders(state.serviceOrders);
  }, [state.serviceOrders]);

  useEffect(() => {
    const startTimeStr = localStorage.getItem('serviceStartTime');
    if (startTimeStr) {
      dispatch({ type: 'SET_START_TIME', payload: new Date(startTimeStr) });
    }

    // Adicionar listener para o evento de início de OS
    const handleServiceStart = (event: CustomEvent) => {
      const { startTime } = event.detail;
      dispatch({ type: 'SET_START_TIME', payload: new Date(startTime) });
    };

    window.addEventListener('serviceStart', handleServiceStart as EventListener);

    return () => {
      window.removeEventListener('serviceStart', handleServiceStart as EventListener);
    };
  }, []);

  useEffect(() => {
    // Adicionar efeito para verificar OS em andamento
    const savedOrders = localStorage.getItem('serviceOrders');
    if (savedOrders) {
      const orders = JSON.parse(savedOrders);
      const activeOrder = orders.find(order => order.status === 'in_progress');
      if (activeOrder) {
        dispatch({ type: 'SET_START_TIME', payload: new Date(activeOrder.createdAt) });
      }
    }

    // Adicionar listener para o evento de início de OS
    const handleServiceOrderStart = (event: CustomEvent) => {
      const { startTime } = event.detail;
      dispatch({ type: 'SET_START_TIME', payload: new Date(startTime) });
    };

    window.addEventListener('serviceOrderStarted', handleServiceOrderStart as EventListener);

    return () => {
      window.removeEventListener('serviceOrderStarted', handleServiceOrderStart as EventListener);
    };
  }, []);

  // Carregar dados do Supabase ao iniciar
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isConnected) {
          const { success, loaded } = await loadAllDataFromSupabase();
          
          if (success) {
            // toast.success('Dados carregados com sucesso!');
          } else {
            toast.error('Erro ao carregar dados do Supabase');
          }
        }
      } catch (error) {
        toast.error('Erro ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isConnected]);

  const handleDeviceChange = (device: string) => {
    dispatch({ type: 'SET_DEVICE', payload: device });
  };

  const handleStatusChange = (status: string) => {
    dispatch({ type: 'SET_STATUS', payload: status });
  };

  const handleQuantityChange = useCallback((newQuantity: string) => {
    try {
      const qty = parseInt(newQuantity);
      
      if (isNaN(qty)) {
        dispatch({ type: 'SET_QUANTITY', payload: '' });
        dispatch({ type: 'SET_DEVICES', payload: [] });
        return;
      }
      
      if (qty > 2000) {
        // toast.error('Quantidade máxima permitida é 2000');
        return;
      }
      
      if (qty < 0) {
        // toast.error('A quantidade não pode ser negativa');
        return;
      }
      
      dispatch({ type: 'SET_QUANTITY', payload: newQuantity });
      
      if (state.selectedDevice && newQuantity) {
        const newDevices = Array.from({ length: qty }, (_, index) => ({
          id: state.counter + index + 1,
          type: state.selectedDevice,
          number: state.counter + index + 1
        }));
        dispatch({ type: 'SET_DEVICES', payload: newDevices });
      } else {
        dispatch({ type: 'SET_DEVICES', payload: [] });
      }
    } catch (error) {
      console.error('Erro ao processar quantidade:', error);
      // toast.error('Erro ao processar quantidade');
    }
  }, [state.selectedDevice, state.counter]);

  const handleDeviceClick = useCallback((deviceId: string) => {
    const device = state.devices.find(d => d.id === deviceId);
    if (device) {
      // Se o dispositivo já tem status, remove o status (desseleção)
      // Se não tem status, usa o status selecionado ou 'Conforme' como padrão
      const newStatus = device.status ? null : (state.selectedStatus || 'Conforme');

      dispatch({
        type: 'UPDATE_DEVICE',
        payload: { id: deviceId, status: newStatus }
      });
    }
  }, [state.devices, state.selectedStatus]);

  const handleSelectAll = useCallback(() => {
    if (state.selectedStatus === 'Conforme') {
      const updatedDevices = state.devices.map(device => ({
        ...device,
        status: device.status ? device.status : 'Conforme'
      }));
      dispatch({ type: 'SET_DEVICES', payload: updatedDevices });
    } else {
      // toast.warning('Selecione o status "Conforme" para usar esta função');
    }
  }, [state.selectedStatus, state.devices]);

  const handleSaveDevices = useCallback(() => {
    if (state.devices.length === 0) {
      // toast.warning('Adicione dispositivos antes de salvar');
      return;
    }

    // Antes de salvar, garantir que o status não é null se savedDevices na State espera string
    const devicesToSave = state.devices.map(device => ({
        ...device,
        status: device.status || '' // Converter null para string vazia se necessário
    }));

    dispatch({ type: 'SAVE_DEVICES', payload: devicesToSave }); // Passar payload para SAVE_DEVICES
    dispatch({ type: 'CLEAR_CURRENT' });
    // toast.success('Dispositivos salvos com sucesso');
  }, [state.devices]);

  const createDeviceRanges = (numbers: number[]): string => {
    if (!numbers.length) return '';
    
    const sortedNumbers = [...numbers].sort((a, b) => a - b);
    const ranges: string[] = [];
    let rangeStart = sortedNumbers[0];
    let prev = sortedNumbers[0];

    for (let i = 1; i <= sortedNumbers.length; i++) {
      const current = sortedNumbers[i];
      if (current !== prev + 1) {
        ranges.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
        rangeStart = current;
      }
      prev = current;
    }

    return ranges.join(', ');
  };

  const isTreatmentService = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_gel'].includes(serviceType);
  const isInspectionService = serviceType === 'inspecao';

  const canFinishOS = useCallback(() => {
    // Obter a lista de serviços do componente ServiceActivity
    const serviceActivityElement = document.querySelector('div[data-service-list]');
    let serviceList = [];
    
    if (serviceActivityElement && serviceActivityElement.getAttribute('data-service-list')) {
      try {
        const serviceListStr = serviceActivityElement.getAttribute('data-service-list') || '[]';
        console.log('Lista de serviços encontrada:', serviceListStr);
        serviceList = JSON.parse(serviceListStr);
      } catch (error) {
        console.error('Erro ao parsear lista de serviços:', error);
        // Em caso de erro de parsing, verificamos os campos do serviço atual
        // Verificar campos obrigatórios
        if (!serviceType || !targetPest) {
          console.log('Campos obrigatórios não preenchidos:', { serviceType, targetPest });
          return false;
        }
        
        // Para serviços de tratamento, verificar se há produto selecionado
        if (isTreatmentService && !state.selectedProduct) {
          console.log('Serviço de tratamento sem produto selecionado');
          return false;
        }
        
        // Para monitoramento, verificar se há dispositivos selecionados
        if (serviceType === 'monitoramento' && state.savedDevices.length === 0) {
          console.log('Monitoramento sem dispositivos selecionados');
          return false;
        }
        
        return true;
      }
    }

    // Se não houver serviços na lista, verificar campos obrigatórios do serviço atual
    if (!serviceList || serviceList.length === 0) {
      console.log('Nenhum serviço na lista, verificando serviço atual');
      // Verificar campos obrigatórios
      if (!serviceType || !targetPest) {
        console.log('Campos obrigatórios não preenchidos:', { serviceType, targetPest });
        return false;
      }
      
      // Para serviços de tratamento, verificar se há produto selecionado
      if (isTreatmentService && !state.selectedProduct) {
        console.log('Serviço de tratamento sem produto selecionado');
        return false;
      }
      
      // Para monitoramento, verificar se há dispositivos selecionados
      if (serviceType === 'monitoramento' && state.savedDevices.length === 0) {
        console.log('Monitoramento sem dispositivos selecionados');
        return false;
      }
    } else {
      console.log('Verificando lista de serviços:', serviceList);
      // Verificar se pelo menos um serviço na lista tem os campos obrigatórios preenchidos
      const hasValidService = serviceList.some(service => {
        // Verificar campos obrigatórios
        if (!service.serviceType || !service.targetPest) {
          console.log('Serviço sem campos obrigatórios:', service);
          return false;
        }
        
        // Para serviços de tratamento, verificar se há produto selecionado
        const isServiceTreatment = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_gel'].includes(service.serviceType);
        if (isServiceTreatment && !service.product) {
          console.log('Serviço de tratamento sem produto:', service);
          return false;
        }
        
        return true;
      });
      
      if (!hasValidService) {
        console.log('Nenhum serviço válido encontrado');
        return false;
      }
    }
    
    console.log('Todos os requisitos atendidos, OS pode ser finalizada');
    return true;
  }, [serviceType, targetPest, isTreatmentService, state.selectedProduct, state.savedDevices.length]);

  const handleFinishOS = useCallback(async () => {
    if (!state.startTime) {
      // toast.error('Por favor, inicie a OS primeiro');
      return;
    }

    const now = new Date();
    dispatch({ type: 'SET_END_TIME', payload: now });
    
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString('pt-BR');
      const formattedTime = currentDate.toLocaleTimeString('pt-BR');

      // Obter dados do cliente do localStorage
      const clientData = localStorage.getItem('selectedClient');
      const client = clientData ? JSON.parse(clientData) : null;

      // Agrupar dispositivos por tipo
      const deviceGroups = state.savedDevices.reduce((acc, device) => {
        if (!acc[device.type]) {
          acc[device.type] = {
            type: device.type,
            quantity: 0,
            status: [],
            list: []
          };
        }

        // Incrementa a quantidade total deste tipo de dispositivo
        acc[device.type].quantity++;
        // Verificar se 'number' existe antes de usar
        if (device.number !== undefined) {
          acc[device.type].list.push(device.number.toString());
        } else {
           acc[device.type].list.push(device.id); // Usar id como fallback
        }

        // Processa os status do dispositivo
        // Garantir que device.status seja um array de strings ou null
        const statusList = Array.isArray(device.status) ? device.status : (device.status ? [device.status] : []);

        statusList.forEach((status: string) => {
          const existingStatus = acc[device.type].status.find((s: any) => s.name === status);
          if (existingStatus) {
            existingStatus.count++;
            // Verificar se 'number' existe antes de usar
            if (device.number !== undefined) {
               existingStatus.devices.push(device.number);
            }
          } else {
             // Verificar se 'number' existe antes de usar ao adicionar novo status
            const devicesArray = device.number !== undefined ? [device.number] : [];
            acc[device.type].status.push({
              name: status,
              count: 1,
              devices: devicesArray
            });
          }
        });

        return acc;
      }, {} as Record<string, any>);

      // Converter para o formato esperado pelo PDF
      const formattedDevices = Object.values(deviceGroups);

      // Preparar dados para o PDF
      // Obter a lista de serviços do componente ServiceActivity
      const serviceActivityElement = document.querySelector('div[data-service-list]');
      let serviceList = [];
      
      if (serviceActivityElement && serviceActivityElement.getAttribute('data-service-list')) {
        try {
          serviceList = JSON.parse(serviceActivityElement.getAttribute('data-service-list') || '[]');
        } catch (error) {
          console.error('Erro ao parsear lista de serviços:', error);
        }
      }
      
      // Obter contagem de pragas por dispositivo
      let pestCounts = [];
      
      // Tentar obter contagens de pragas do localStorage
      const savedPestCounts = localStorage.getItem('pestCounts');
      if (savedPestCounts) {
        try {
          pestCounts = JSON.parse(savedPestCounts);
          console.log('Contagem de pragas carregada do localStorage:', pestCounts);
        } catch (error) {
          console.error('Erro ao parsear contagens de pragas do localStorage:', error);
        }
      }
      
      // Se não houver dados no localStorage, verificar dispositivos no estado
      if (pestCounts.length === 0) {
        // Verificar se há dispositivos com pragas no estado (agora device.pests pode não existir)
        if (state.devices && state.devices.some((device: any) => device.pests && device.pests.length > 0)) {
          pestCounts = state.devices
            .filter((device: any) => device.pests && device.pests.length > 0)
            .map((device: any) => ({
              deviceType: device.type,
              deviceNumber: device.number !== undefined ? device.number : device.id, // Usar number se existir, caso contrário usar id
              pests: device.pests
            }));
        } else {
          // Verificar se há dispositivos salvos com pragas (agora device.pests pode não existir)
          pestCounts = state.savedDevices
            .filter((device: any) => device.pests && device.pests.length > 0)
            .map((device: any) => ({
              deviceType: device.type,
              deviceNumber: device.number !== undefined ? device.number : device.id, // Usar number se existir, caso contrário usar id
              pests: device.pests
            }));
        }
      }
      
      // Log para debug da contagem de pragas
      console.log('Contagem de pragas encontrada:', pestCounts);
      
      // Converter a lista de serviços para o formato esperado pelo pdfService
      const services = serviceList.length > 0 
        ? serviceList.map(service => ({
            type: service.serviceType,
            target: service.targetPest,
            location: service.location,
            product: service.product ? {
              name: service.product.name,
              activeIngredient: service.product.activeIngredient,
              chemicalGroup: service.product.chemicalGroup,
              registration: service.product.registration,
              batch: service.product.batch,
              validity: service.product.validity,
              quantity: service.productAmount ? `${service.productAmount} ${service.product.quantity}` : "N/A",
              dilution: service.product.dilution
            } : undefined
          }))
        : [{
            type: serviceType,
            target: targetPest,
            location: location || "N/A",
            product: state.selectedProduct ? {
              name: state.selectedProduct.name,
              activeIngredient: state.selectedProduct.activeIngredient,
              chemicalGroup: state.selectedProduct.chemicalGroup,
              registration: state.selectedProduct.registration,
              batch: state.selectedProduct.batch,
              validity: state.selectedProduct.validity,
              quantity: productAmount ? `${productAmount} ${state.selectedProduct.quantity}` : "N/A",
              dilution: state.selectedProduct.dilution
            } : undefined
          }];
      
      // Log para debug dos serviços
      console.log('Serviços a serem incluídos no PDF:', services);
      
      const serviceData = {
        orderNumber: `${state.serviceOrders.length + 1}`,
        date: formattedDate,
        startTime: state.startTime?.toLocaleTimeString('pt-BR') || formattedTime,
        endTime: state.endTime?.toLocaleTimeString('pt-BR') || formattedTime,
        client: client || {
          code: "N/A",
          branch: "Cliente não selecionado",
          name: "Cliente não selecionado",
          document: "N/A",
          address: "N/A",
          contact: "N/A",
          phone: "N/A"
        },
        // Adiciona a lista de serviços para o PDF
        services: services,
        // Mantido para compatibilidade com código existente
        service: {
          type: serviceType,
          target: targetPest,
          location: location || "N/A"
        },
        product: state.selectedProduct ? {
          name: state.selectedProduct.name,
          activeIngredient: state.selectedProduct.activeIngredient,
          chemicalGroup: state.selectedProduct.chemicalGroup,
          registration: state.selectedProduct.registration,
          batch: state.selectedProduct.batch,
          validity: state.selectedProduct.validity,
          quantity: productAmount ? `${productAmount} ${state.selectedProduct.quantity}` : "N/A",
          dilution: state.selectedProduct.dilution
        } : null,
        devices: formattedDevices,
        pestCounts: pestCounts && pestCounts.length > 0 ? pestCounts : undefined, // Adicionando contagem de pragas para exibir no PDF
        observations: observations || "",
        signatures: {
          serviceResponsible: "Técnico Responsável",
          technicalResponsible: "Responsável Técnico",
          clientRepresentative: "Representante do Cliente"
        }
      };

      // Gerar e baixar o PDF
      try {
        const pdfBlob = await generateServiceOrderPDF(serviceData as any);
        const url = window.URL.createObjectURL(pdfBlob);
        
        // Adicionar à lista de ordens de serviço
        dispatch({
          type: 'ADD_SERVICE_ORDER',
          payload: {
            devices: state.savedDevices,
            pdfUrl: url,
            client: serviceData.client,
            service: serviceData.service,
            product: serviceData.product as any,
            observations: observations || "",
            startTime: formattedTime,
            endTime: formattedTime,
            signatures: serviceData.signatures as any
          } as any
        });

        // Baixar o PDF
        const link = document.createElement('a');
        link.href = url;
        link.download = `ordem-servico-${serviceData.orderNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Limpar os campos após salvar
        setServiceType('');
        setTargetPest('');
        setApplicationMethod('');
        setLocation('');
        setObservations('');
        setProductAmount('');
        dispatch({ type: 'SET_SELECTED_PRODUCT', payload: null });
        dispatch({ type: 'CLEAR_CURRENT' });

        // Limpar o horário de início do localStorage
        localStorage.removeItem('serviceStartTime');

        showNotification('Ordem de serviço finalizada com sucesso!', 'success');
        
        // Obter o ID do agendamento ativo
        const savedOrders = localStorage.getItem('safeprag_service_orders');
        if (savedOrders) {
          const orders = JSON.parse(savedOrders);
          const activeOrder = orders.find((order: any) => order.status === 'in_progress');
          if (activeOrder) {
            // Disparar evento de finalização com sucesso
            const finishEvent = new CustomEvent('serviceOrderFinished', { 
              detail: { success: true }
            });
            window.dispatchEvent(finishEvent);

            // Disparar evento de atualização do card
            const updateEvent = new CustomEvent('scheduleUpdate', {
              detail: { 
                scheduleId: activeOrder.scheduleId,
                status: 'completed'
              }
            });
            window.dispatchEvent(updateEvent);

            // Atualizar o status do agendamento
            updateScheduleStatus(activeOrder.scheduleId, 'completed');
          }
        }
        
        setActiveTab('schedule');
      } catch (pdfError) {
        console.error('Erro ao gerar PDF:', pdfError);
        showNotification('Erro ao gerar o PDF. Verifique os dados e tente novamente.', 'error');
      }
    } catch (error) {
      console.error('Erro ao finalizar ordem de serviço:', error);
      showNotification('Erro ao finalizar ordem de serviço. Tente novamente.', 'error');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [
    canFinishOS,
    state.serviceOrders.length,
    serviceType,
    targetPest,
    location,
    productAmount,
    state.selectedProduct,
    observations,
    state.savedDevices,
    dispatch,
    setActiveTab
  ]);

  useEffect(() => {
    // Salvar devices quando houver mudanças
    storageService.saveDevices(state.devices);
  }, [state.devices]);

  useEffect(() => {
    // Salvar service orders quando houver mudanças
    storageService.saveServiceOrders(state.serviceOrders);
  }, [state.serviceOrders]);

  const handlePageChange = useCallback((page: string) => {
    dispatch({ type: 'SET_PAGE', payload: page });
  }, []);

  const shouldDisableFields = useCallback(() => {
    return serviceType === 'tratamento';
  }, [serviceType]);

  const canSave = useCallback(() => {
    if (isTreatmentService) {
      return true;
    }
    return !state.isLoading && state.devices.length > 0;
  }, [isTreatmentService, state.isLoading, state.devices.length]);

  const handleSaveTreatment = () => {
    // TODO: Implementar a lógica de salvar os dados do tratamento
    console.log('Salvando dados do tratamento');
  };

  const handleGenerateServiceOrder = useCallback(async (serviceData: any) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // A estrutura de formattedDeviceGroups precisa corresponder à esperada por generateServiceOrderPDF
      // Com base na análise anterior, generateServiceOrderPDF espera um array de objetos com 'type', 'quantity', 'status' (que é um array), e 'list'.
      // Vamos tentar reformatar savedDevices para corresponder a isso.
      const formattedDeviceGroups = state.savedDevices.reduce((acc: any, device: any) => {
        if (!acc[device.type]) {
          acc[device.type] = {
            type: device.type,
            quantity: 0,
            status: [], // Status deve ser um array
            list: []
          };
        }

        acc[device.type].quantity++;
        // Verificar se 'number' existe antes de usar
        if (device.number !== undefined) {
          acc[device.type].list.push(device.number.toString());
        } else {
           acc[device.type].list.push(device.id); // Usar id como fallback
        }
        
        // Processar os status do dispositivo - garantir que seja um array de strings
        const statusList = Array.isArray(device.status) ? device.status : (device.status ? [device.status] : []);

        statusList.forEach((status: string) => {
          const existingStatus = acc[device.type].status.find((s: any) => s.name === status);
          if (existingStatus) {
            existingStatus.count++;
            // Verificar se 'number' existe antes de usar
            if (device.number !== undefined) {
               existingStatus.devices.push(device.number);
            }
          } else {
             // Verificar se 'number' existe antes de usar ao adicionar novo status
            const devicesArray = device.number !== undefined ? [device.number] : [];
            acc[device.type].status.push({
              name: status,
              count: 1,
              devices: devicesArray
            });
          }
        });

        return acc;
      }, {} as Record<string, any>);

      // Converter o objeto agrupado de volta para um array de valores
      const formattedDevicesArray = Object.values(formattedDeviceGroups);

      const pdfUrl = await generateServiceOrderPDF({
        devices: formattedDevicesArray as any, // Usar o array formatado e 'as any' temporariamente
        client: { // Adicionar campos faltantes ou garantir que sejam opcionais na interface ServiceOrderPDFData
          code: serviceData.clientCode,
          name: serviceData.clientName,
          document: "N/A",
          address: "N/A",
          contact: "N/A",
          phone: "N/A",
          branch: "N/A",
          city: "N/A", // Adicionado campo city
          email: "N/A" // Adicionado campo email
        },
        service: { // A estrutura de serviceData.service pode ser diferente da esperada
           type: serviceData.serviceType,
           target: serviceData.targetPest || targetPest,
           location: serviceData.location || location,
           product: serviceData.product // Usar product do serviceData se existir
        } as any, // Usar any temporariamente
        product: state.selectedProduct ? { // Usar selectedProduct do estado se estiver presente
          name: state.selectedProduct?.name || "N/A",
          activeIngredient: state.selectedProduct?.activeIngredient || "N/A",
          chemicalGroup: state.selectedProduct?.chemicalGroup || "N/A",
          registration: state.selectedProduct?.registration || "N/A",
          batch: state.selectedProduct?.batch || "N/A",
          validity: state.selectedProduct?.validity || "N/A",
          quantity: productAmount ? `${productAmount} ${state.selectedProduct?.quantity}` : "N/A",
          dilution: state.selectedProduct?.dilution || "N/A"
        } : undefined, // Definir como undefined se não houver selectedProduct
        observations: observations || "", // Usar observations do estado
        startTime: state.startTime?.toLocaleTimeString('pt-BR') || "N/A", // Usar startTime do estado
        endTime: state.endTime?.toLocaleTimeString('pt-BR') || "N/A", // Usar endTime do estado
        signatures: serviceData.signatures as any, // Usar any temporariamente
        pestCounts: serviceData.pestCounts
      } as any); // Usar any temporariamente para o objeto completo

      dispatch({
        type: 'ADD_SERVICE_ORDER',
        payload: { // Adicionar 'as any' temporariamente para resolver o erro de tipagem aqui
           // Os dados aqui devem corresponder EXATAMENTE à interface ServiceOrder
           id: state.serviceOrders.length + 1, // ID sequencial
           createdAt: new Date().toISOString(), // Data de criação
           updatedAt: new Date().toISOString(), // Data de atualização
           status: 'completed', // Status inicial
           devices: state.savedDevices.map(device => ({ // Mapear savedDevices para a estrutura esperada
              id: device.id,
              type: device.type,
              status: device.status || '', // Garantir que status não seja null aqui se a interface não permitir
              quantity: device.quantity,
              number: (device as any).number // Acessar number com any
           })),
           pdfUrl: pdfUrl,
           client: { // Mapear client do serviceData para a estrutura esperada
             code: serviceData.client.code || "N/A",
             name: serviceData.client.name || "N/A",
             address: serviceData.client.address || "N/A" // Usar address do client data
           },
           // A propriedade 'service' não existe na interface ServiceOrder, remover ou ajustar
           // service: serviceData.service,
           // A propriedade 'product' não existe na interface ServiceOrder, remover ou ajustar
           // product: serviceData.product,
           observations: observations || "",
           // As propriedades startTime, endTime, signatures não existem diretamente na interface ServiceOrder, remover ou ajustar
           // startTime: serviceData.time,
           // endTime: serviceData.endTime,
           // signatures: serviceData.signatures
        } as any // Usar any temporariamente para o objeto completo
      });

      showNotification('Ordem de serviço gerada e baixada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao gerar ordem de serviço:', error);
      showNotification('Erro ao gerar ordem de serviço. Tente novamente.', 'error');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.savedDevices, serviceType, targetPest, location, productAmount, state.selectedProduct, observations, dispatch]);

  const handleServiceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newServiceType = e.target.value;
    setServiceType(newServiceType);
    
    // Verifica se o novo tipo de serviço NÃO usa produto
    const treatmentTypes = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_com_gel'];
    const isProductService = treatmentTypes.includes(newServiceType.toLowerCase()) || newServiceType.toLowerCase() === 'monitoramento';

    // Se o tipo de serviço não usa produto, limpa a seleção de produto no estado do App
    if (!isProductService) {
      dispatch({ type: 'CLEAR_SELECTED_PRODUCT' });
    }

    // Limpa o método de aplicação se não for tratamento
    if (newServiceType !== 'tratamento') { // TODO: Verificar se 'tratamento' é usado como categoria ou tipo específico
      setApplicationMethod('');
    }
  };

  const handleOpenDeviceModal = () => {
    setShowDeviceModal(true);
  };

  console.log('Estado atual:', { activeTab, state });

  const navItems = [
    { id: 'schedule', label: 'Agenda', icon: Calendar },
    { id: 'activity', label: 'Atividade', icon: Activity },
    { id: 'settings', label: 'Admin', icon: Settings },
  ];

  const getActiveServiceOrder = () => {
    const savedOrders = localStorage.getItem('serviceOrders');
    if (savedOrders) {
      const orders = JSON.parse(savedOrders);
      return orders.find(order => order.status === 'in_progress');
    }
    return null;
  };

  const finishServiceOrder = (orderId: number) => {
    const savedOrders = localStorage.getItem('serviceOrders');
    if (savedOrders) {
      const orders = JSON.parse(savedOrders);
      const updatedOrders = orders.map(order => {
        if (order.id === orderId) {
          return { ...order, status: 'finished' };
        }
        return order;
      });
      localStorage.setItem('serviceOrders', JSON.stringify(updatedOrders));
    }
  };

  const approveServiceOrder = (orderId: number) => {
    const savedOrders = localStorage.getItem('serviceOrders');
    if (savedOrders) {
      const orders = JSON.parse(savedOrders);
      const updatedOrders = orders.map(order => {
        if (order.id === orderId) {
          return { ...order, status: 'approved' };
        }
        return order;
      });
      localStorage.setItem('serviceOrders', JSON.stringify(updatedOrders));
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'activity') {
      const startTimeStr = localStorage.getItem('serviceStartTime');
      if (startTimeStr) {
        dispatch({ type: 'SET_START_TIME', payload: new Date(startTimeStr) });
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div>Carregando dados...</div>
        <div style={{ fontSize: '0.8rem', color: '#666' }}>
          {isConnected ? 'Conectado ao Supabase' : 'Usando dados locais'}
        </div>
      </div>
    );
  }

  return (
    <KeepAliveProvider>
      <div className="flex flex-col h-screen bg-gray-100">
        {activeTab === 'schedule' && (
          <ServiceScheduler 
            onTabChange={handleTabChange} 
            onOSStart={() => handleTabChange('activity')} 
          />
        )}
        {activeTab === 'activity' && (
          <ServiceActivity
            serviceType={serviceType}
            targetPest={targetPest}
            location={location}
            observations={observations}
            applicationMethod={applicationMethod}
            productAmount={productAmount}
            state={state}
            startTime={state.startTime}
            endTime={state.endTime}
            isLoading={state.isLoading}
            showDeviceModal={showDeviceModal}
            onServiceTypeChange={handleServiceTypeChange}
            onTargetPestChange={setTargetPest}
            onLocationChange={setLocation}
            onApplicationMethodChange={setApplicationMethod}
            onProductAmountChange={setProductAmount}
            onObservationsChange={setObservations}
            onOpenDeviceModal={handleOpenDeviceModal}
            onCloseDeviceModal={() => setShowDeviceModal(false)}
            onFinishOS={handleFinishOS}
            onApproveOS={() => setShowApprovalModal(true)}
            onProductSelect={(product) => {
              dispatch({
                type: 'SET_SELECTED_PRODUCT',
                payload: {
                  name: product.name,
                  activeIngredient: product.activeIngredient,
                  chemicalGroup: product.chemicalGroup,
                  registration: product.registration,
                  batch: product.batch,
                  validity: product.expirationDate,
                  quantity: product.measure,
                  dilution: product.diluent
                }
              });
            }}
            onDeviceChange={handleDeviceChange}
            onStatusChange={handleStatusChange}
            onQuantityChange={handleQuantityChange}
            onDeviceClick={handleDeviceClick}
            onSelectAll={handleSelectAll}
            onSaveDevices={handleSaveDevices}
            canFinishOS={canFinishOS}
            canSave={isTreatmentService || (!state.isLoading && state.devices.length > 0)}
            onProductClear={() => dispatch({ type: 'CLEAR_SELECTED_PRODUCT' })}
          />
        )}
        {activeTab === 'settings' && <AdminPage />}
      </div>

      <NotificationToast />
      <BottomNavBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        items={navItems}
      />
      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onConfirm={(data) => {
          console.log('Dados de aprovação:', data);
          const activeOrder = getActiveServiceOrder();
          if (activeOrder) {
            approveServiceOrder(activeOrder.id)
              .then(() => {
                showNotification('Ordem de serviço aprovada com sucesso!', 'success');
                setActiveTab('schedule');
                setShowApprovalModal(false);
              })
              .catch(error => {
                console.error('Erro ao aprovar OS:', error);
                showNotification('Erro ao aprovar ordem de serviço.', 'error');
              });
          } else {
            showNotification('Nenhuma ordem de serviço ativa encontrada para aprovar.', 'warning');
            setShowApprovalModal(false);
          }
        }}
      />
    </KeepAliveProvider>
  );
}

export default App;

