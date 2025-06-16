import React, { useRef, useState, useEffect } from 'react';
import { CheckCircle, ThumbsUp, Plus, Trash2, Calendar, Clock } from 'lucide-react';
import { LocationSelector } from './LocationSelector';
import { DeviceSelector } from './DeviceSelector';
import { StatusSelector } from './StatusSelector';
import { QuantityInput } from './QuantityInput';
import { DeviceGrid } from './DeviceGrid';
import { DeviceSummary } from './DeviceSummary';
import { ProductSelector } from './ProductSelector';
import { ServiceItem } from '../types/pdf.types';
import RetroactiveServiceModal from './RetroactiveServiceModal';
import { PestCountingSection } from './ServiceActivity/PestCountingSection';
import { PestCountingModal } from './ServiceActivity/PestCountingModal';
import { format } from 'date-fns';

import { Pest, DevicePestCount } from '../types/pest.types';

interface ServiceActivityProps {
  serviceType: string;
  targetPest: string;
  location: string;
  observations: string;
  applicationMethod: string;
  productAmount: string;
  state: any;
  startTime: Date | null;
  endTime: Date | null;
  isLoading: boolean;
  showDeviceModal: boolean;
  onServiceTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onTargetPestChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onApplicationMethodChange: (value: string) => void;
  onProductAmountChange: (value: string) => void;
  onObservationsChange: (value: string) => void;
  onOpenDeviceModal: () => void;
  onCloseDeviceModal: () => void;
  onFinishOS: () => void;
  onApproveOS: () => void;
  onProductSelect: (product: any) => void;
  onDeviceChange: (device: string) => void;
  onStatusChange: (status: string) => void;
  onQuantityChange: (quantity: string) => void;
  onDeviceClick: (deviceId: number) => void;
  onSelectAll: () => void;
  onSaveDevices: () => void;
  canFinishOS: () => boolean;
  canSave: boolean;
  onProductClear?: () => void;
}

// Interface para um serviço individual na lista de serviços
interface ServiceListItem {
  id: string;
  serviceType: string;
  targetPest: string;
  location: string;
  product: any | null;
  productAmount: string;
}

const ServiceActivity: React.FC<ServiceActivityProps> = ({
  serviceType,
  targetPest,
  location,
  observations,
  applicationMethod,
  productAmount,
  state,
  startTime,
  endTime,
  isLoading,
  showDeviceModal,
  onServiceTypeChange,
  onTargetPestChange,
  onLocationChange,
  onApplicationMethodChange,
  onProductAmountChange,
  onObservationsChange,
  onOpenDeviceModal,
  onCloseDeviceModal,
  onFinishOS,
  onApproveOS,
  onProductSelect,
  onDeviceChange,
  onStatusChange,
  onQuantityChange,
  onDeviceClick,
  onSelectAll,
  onSaveDevices,
  canFinishOS,
  canSave,
  onProductClear
}) => {
  const dashboardRef = useRef<HTMLDivElement>(null);
  
  // Adicionar log para debug dos valores
  console.log('Valor atual de serviceType:', serviceType);
  
  const isTreatmentService = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_com_gel'].includes(serviceType.toLowerCase());
  const showProductSelector = isTreatmentService || serviceType.toLowerCase() === 'monitoramento';
  
  // Adicionar logs para debug
  console.log('isTreatmentService:', isTreatmentService);
  console.log('showProductSelector:', showProductSelector);
  console.log('Lista de serviços de tratamento:', ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_com_gel']);
  
  const [showNewPestInput, setShowNewPestInput] = useState(false);
  const [newPest, setNewPest] = useState('');
  const [showNewServiceInput, setShowNewServiceInput] = useState(false);
  const [newService, setNewService] = useState('');
  const [localStartTime, setLocalStartTime] = useState<Date | null>(startTime);
  const [showRetroactiveModal, setShowRetroactiveModal] = useState(false);
  const [showPestCountingModal, setShowPestCountingModal] = useState(false);
  
  // Estado para gerenciar múltiplos serviços
  const [serviceList, setServiceList] = useState<ServiceListItem[]>([]);
  
  // Estado para gerenciar contagem de pragas
  const [pestCounts, setPestCounts] = useState<DevicePestCount[]>([]);
  const [currentServiceId, setCurrentServiceId] = useState<string | null>(null);
  
  // Lista inicial de pragas comuns
  const initialPests = [
    'Roedores',
    'Baratas',
    'Moscas',
    'Formigas',
    'Cupins',
    'Aranhas',
    'Escorpiões',
    'Percevejos',
    'Pulgas',
    'Carrapatos',
    'Traças',
    'Vespas',
  ];

  const [availablePests, setAvailablePests] = useState<string[]>(initialPests);
  
  // Lista inicial de tipos de serviço
  const initialServiceTypes = [
    'Inspeção',
    'Monitoramento',
    'Pulverização',
    'Atomização',
    'Termonebulização',
    'Polvilhamento',
    'Iscagem com gel',
  ];

  const [availableServiceTypes, setAvailableServiceTypes] = useState<string[]>(initialServiceTypes);
  
  // Função para salvar as contagens de pragas
  const handleSavePestCounts = (counts: DevicePestCount[]) => {
    setPestCounts(counts);
    // Salvar no localStorage para persistência
    localStorage.setItem('pestCounts', JSON.stringify(counts));
    // Salvar também na ordem de serviço ativa
    const activeOrderStr = localStorage.getItem('active_service_order');
    if (activeOrderStr) {
      try {
        const activeOrder = JSON.parse(activeOrderStr);
        activeOrder.pestCounts = counts;
        localStorage.setItem('active_service_order', JSON.stringify(activeOrder));
      } catch (error) {
        console.error('Erro ao salvar contagens de pragas na ordem de serviço ativa:', error);
      }
    }
    // Salvar também na lista de ordens de serviço
    const serviceOrdersStr = localStorage.getItem('safeprag_service_orders');
    if (serviceOrdersStr) {
      try {
        const serviceOrders = JSON.parse(serviceOrdersStr);
        const activeOrderIndex = serviceOrders.findIndex((order: any) => order.status === 'in_progress');
        if (activeOrderIndex >= 0) {
          serviceOrders[activeOrderIndex].pestCounts = counts;
          localStorage.setItem('safeprag_service_orders', JSON.stringify(serviceOrders));
        }
      } catch (error) {
        console.error('Erro ao salvar contagens de pragas na lista de ordens de serviço:', error);
      }
    }
    console.log('Contagens de pragas salvas:', counts);
  };

  // Carrega o horário do localStorage ao montar o componente
  useEffect(() => {
    const storedStartTime = localStorage.getItem('serviceStartTime');
    if (storedStartTime) {
      setLocalStartTime(new Date(storedStartTime));
    }
    
    // Inicializa a lista de serviços com o serviço atual se existir
    // ou cria um serviço vazio para permitir a adição de múltiplos serviços
    if (serviceType && targetPest) {
      const initialService: ServiceListItem = {
        id: Date.now().toString(),
        serviceType,
        targetPest,
        location,
        product: state.selectedProduct,
        productAmount
      };
      setServiceList([initialService]);
      setCurrentServiceId(initialService.id);
    } else {
      // Cria um serviço vazio para permitir a adição de múltiplos serviços
      const emptyService: ServiceListItem = {
        id: Date.now().toString(),
        serviceType: '',
        targetPest: '',
        location: '',
        product: null,
        productAmount: ''
      };
      setServiceList([emptyService]);
      setCurrentServiceId(emptyService.id);
    }
  }, []);
  
  // Funções para gerenciar múltiplos serviços
  const addNewService = () => {
    const newServiceItem: ServiceListItem = {
      id: Date.now().toString(),
      serviceType: '',
      targetPest: '',
      location: '',
      product: null,
      productAmount: ''
    };
    setServiceList([...serviceList, newServiceItem]);
    setCurrentServiceId(newServiceItem.id);
    
    // Limpa os campos do formulário para o novo serviço
    onServiceTypeChange({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>);
    onTargetPestChange('');
    onLocationChange('');
    onProductAmountChange('');
    onProductSelect(null);
  };
  
  const removeService = (id: string) => {
    const updatedList = serviceList.filter(service => service.id !== id);
    setServiceList(updatedList);
    
    // Se removeu o serviço atual, seleciona o primeiro da lista
    if (id === currentServiceId && updatedList.length > 0) {
      setCurrentServiceId(updatedList[0].id);
      const currentService = updatedList[0];
      
      // Atualiza os campos do formulário com os dados do serviço selecionado
      onServiceTypeChange({ target: { value: currentService.serviceType } } as React.ChangeEvent<HTMLSelectElement>);
      onTargetPestChange(currentService.targetPest);
      onLocationChange(currentService.location);
      onProductAmountChange(currentService.productAmount);
      onProductSelect(currentService.product);
    }
  };
  
  const selectService = (id: string) => {
    setCurrentServiceId(id);
    const selectedService = serviceList.find(service => service.id === id);
    if (selectedService) {
      // Atualiza os campos do formulário com os dados do serviço selecionado
      onServiceTypeChange({ target: { value: selectedService.serviceType } } as React.ChangeEvent<HTMLSelectElement>);
      onTargetPestChange(selectedService.targetPest);
      onLocationChange(selectedService.location);
      onProductAmountChange(selectedService.productAmount);
      onProductSelect(selectedService.product);
    }
  };
  
  // Atualiza o serviço atual na lista quando os campos mudam
  useEffect(() => {
    if (currentServiceId) {
      setServiceList(prevList => 
        prevList.map(service => {
          // Definir os tipos de serviço que usam produto
          const productServiceTypes = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_com_gel', 'monitoramento'];

          // Verificar se o tipo de serviço DO ITEM da lista usa produto
          const itemUsesProduct = productServiceTypes.includes(service.serviceType.toLowerCase());

          return service.id === currentServiceId 
            ? {
                ...service,
                serviceType,
                targetPest,
                location,
                // Incluir o produto SOMENTE se o tipo de serviço do item usar produto E houver um produto selecionado
                product: itemUsesProduct ? state.selectedProduct : null,
                productAmount
              }
            : service;
        })
      );
    }
  }, [serviceType, targetPest, location, state.selectedProduct, productAmount, currentServiceId]);

  // Atualiza quando receber evento de início de OS
  useEffect(() => {
    const handleServiceStart = (event: CustomEvent) => {
      console.log('ServiceActivity recebeu evento de início de OS:', event.detail);
      if (event.detail?.startTime) {
        setLocalStartTime(new Date(event.detail.startTime));
      }

      // Resetar todos os campos quando iniciar uma nova OS
      if (!event.detail?.isRetroactive) {
        // Limpa os campos do formulário para a nova OS
        onServiceTypeChange({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>);
        onTargetPestChange('');
        onLocationChange('');
        onApplicationMethodChange('');
        onProductAmountChange('');
        onObservationsChange('');
        onProductSelect(null);

        // Limpa a lista de serviços e cria um novo serviço vazio
        const emptyService: ServiceListItem = {
          id: Date.now().toString(),
          serviceType: '',
          targetPest: '',
          location: '',
          product: null,
          productAmount: ''
        };
        setServiceList([emptyService]);
        setCurrentServiceId(emptyService.id);

        // Limpa as contagens de pragas e reseta as listas dinâmicas
        setPestCounts([]);
        localStorage.removeItem('pestCounts');
        setAvailablePests(initialPests); // Reseta a lista de pragas dinâmicas
        setAvailableServiceTypes(initialServiceTypes); // Reseta a lista de tipos de serviço dinâmicos

        // Limpa outros estados locais
        setShowNewPestInput(false);
        setNewPest('');
        setShowNewServiceInput(false);
        setNewService('');

        console.log('Todos os campos foram resetados para a nova OS');
      }
    };

    window.addEventListener('serviceStart', handleServiceStart as EventListener);
    return () => {
      window.removeEventListener('serviceStart', handleServiceStart as EventListener);
    };
  }, [onServiceTypeChange, onTargetPestChange, onLocationChange, onApplicationMethodChange,
      onProductAmountChange, onObservationsChange, onProductSelect]);

  // Atualiza o localStartTime quando o startTime prop muda
  useEffect(() => {
    if (startTime) {
      setLocalStartTime(startTime);
    }
  }, [startTime]);

  // Recarregar a página quando a OS for finalizada com sucesso
  useEffect(() => {
    const handleServiceOrderFinished = (event: CustomEvent) => {
      // Só recarrega a página se não for uma OS retroativa
      if (event.detail?.success && !event.detail?.isRetroactive) {
        setPestCounts([]);
        localStorage.removeItem('pestCounts');
        window.location.reload();
      }
    };

    window.addEventListener('serviceOrderFinished', handleServiceOrderFinished as EventListener);
    return () => {
      window.removeEventListener('serviceOrderFinished', handleServiceOrderFinished as EventListener);
    };
  }, []);

  // Converte a lista de serviços para JSON para ser acessada pelo App.tsx
  const serviceListJson = JSON.stringify(serviceList);

  // Função para lidar com os dados retroativos
  const handleRetroactiveData = (data: {
    date: string;
    startTime: string;
    endTime: string;
    duration: string;
  }) => {
    console.log('Dados retroativos:', data);
    
    // Cria objetos Date para início e fim
    const startDate = new Date(`${data.date}T${data.startTime}:00`);
    setLocalStartTime(startDate);
    
    // Armazena os dados retroativos no localStorage para uso na geração do PDF
    localStorage.setItem('retroactive_service_data', JSON.stringify({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      duration: data.duration,
      isRetroactive: true
    }));
    
    // Dispara evento de início de OS com data retroativa
    const startEvent = new CustomEvent('serviceStart', {
      detail: {
        startTime: startDate.toISOString(),
        isRetroactive: true,
        date: data.date,
        endTime: data.endTime
      }
    });
    window.dispatchEvent(startEvent);
    
    // Se tiver horário de fim, também dispara evento de finalização
    if (data.endTime) {
      const endDate = new Date(`${data.date}T${data.endTime}:00`);
      
      // Dispara evento de finalização com pequeno atraso para garantir que o início seja processado primeiro
      setTimeout(() => {
        const endEvent = new CustomEvent('serviceOrderFinished', {
          detail: {
            success: true,
            isRetroactive: true,
            endTime: endDate.toISOString()
          }
        });
        window.dispatchEvent(endEvent);
      }, 500);
    }
  };
  
  // Carregar contagens de pragas do localStorage ao iniciar
  useEffect(() => {
    const savedCounts = localStorage.getItem('pestCounts');
    if (savedCounts) {
      try {
        setPestCounts(JSON.parse(savedCounts));
      } catch (error) {
        console.error('Erro ao carregar contagens de pragas:', error);
      }
    }
  }, []);

  // Função para adicionar nova praga à lista
  const handleAddNewPest = () => {
    const trimmedPest = newPest.trim();
    if (trimmedPest && !availablePests.find(pest => pest.toLowerCase() === trimmedPest.toLowerCase())) {
      setAvailablePests([...availablePests, trimmedPest]);
      onTargetPestChange(trimmedPest); // Seleciona a nova praga automaticamente
      setNewPest('');
      // Ocultar o input e botões após a adição bem-sucedida
      setShowNewPestInput(false);
    } else if (trimmedPest) {
      // Opcional: adicionar feedback visual se a praga já existe
      console.log('Praga já existe na lista');
      // Limpar o campo e ocultar mesmo se já existir
      setNewPest('');
      setShowNewPestInput(false);
    }
  };

  // Função para remover uma praga adicionada dinamicamente
  const handleRemovePest = (pestToRemove: string) => {
    // Adicionar confirmação ou feedback visual aqui se necessário
    const updatedPests = availablePests.filter(pest => pest !== pestToRemove);
    setAvailablePests(updatedPests);

    // Se a praga removida for a praga alvo atual, limpa a seleção
    if (targetPest.toLowerCase() === pestToRemove.toLowerCase()) {
      onTargetPestChange('');
    }
  };

  // Função para adicionar novo tipo de serviço à lista
  const handleAddNewServiceType = () => {
    const trimmedServiceType = newService.trim();
    if (trimmedServiceType && !availableServiceTypes.find(type => type.toLowerCase() === trimmedServiceType.toLowerCase())) {
      setAvailableServiceTypes([...availableServiceTypes, trimmedServiceType]);
      // onServiceTypeChange({ target: { value: trimmedServiceType } } as React.ChangeEvent<HTMLSelectElement>); // Seleciona o novo tipo automaticamente
      // Removi a seleção automática para seguir o padrão atual do campo de serviço que não seleciona
      setNewService('');
      // Ocultar o input e botões após a adição bem-sucedida
      setShowNewServiceInput(false);
    } else if (trimmedServiceType) {
      console.log('Tipo de serviço já existe na lista');
      // Limpar o campo e ocultar mesmo se já existir
      setNewService('');
      setShowNewServiceInput(false);
    }
  };

  // Função para remover um tipo de serviço adicionado dinamicamente
  const handleRemoveServiceType = (serviceTypeToRemove: string) => {
    const updatedServiceTypes = availableServiceTypes.filter(type => type !== serviceTypeToRemove);
    setAvailableServiceTypes(updatedServiceTypes);

    // Se o tipo de serviço removido for o tipo de serviço atual, limpa a seleção
    if (serviceType.toLowerCase() === serviceTypeToRemove.toLowerCase()) {
      onServiceTypeChange({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  return (
    <div className="space-y-4 p-4 pb-52" ref={dashboardRef} data-service-list={serviceListJson}>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold">Ordem de Serviço</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRetroactiveModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
              title="Criar OS retroativa"
            >
              <Calendar className="h-4 w-4" />
              <span>OS Retroativa</span>
            </button>
            {localStartTime && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Início: </span>
                {localStartTime.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* Lista de serviços adicionados - mostrar apenas se houver serviços com tipo definido */}
        {/* Ocultado da interface */}
        {serviceList.some(service => service.serviceType) && (
          <div className="mb-6 border rounded-lg p-4 bg-gray-50" style={{ display: 'none' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900">Serviços Adicionados</h3>
              <button
                onClick={addNewService}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-1 text-sm"
              >
                <Plus size={16} />
                Adicionar Serviço
              </button>
            </div>
            <div className="space-y-2">
              {serviceList.map((service) => (
                <div 
                  key={service.id} 
                  className={`flex justify-between items-center p-2 rounded-md cursor-pointer ${service.id === currentServiceId ? 'bg-blue-100 border border-blue-300' : 'bg-white border'}`}
                  onClick={() => selectService(service.id)}
                >
                  <div>
                    <div className="font-medium">{service.serviceType ? service.serviceType.charAt(0).toUpperCase() + service.serviceType.slice(1) : 'Novo Serviço'}</div>
                    <div className="text-sm text-gray-600">
                      {service.targetPest ? `Alvo: ${service.targetPest}` : ''}
                      {service.location ? ` | Local: ${service.location}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeService(service.id);
                    }}
                    className="p-1 text-red-500 hover:text-red-700"
                    disabled={serviceList.length <= 1}
                    title={serviceList.length <= 1 ? "Pelo menos um serviço é necessário" : "Remover serviço"}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campo Tipo de Serviço */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Serviço *
          </label>
          <select
            value={serviceType}
            onChange={(e) => {
              const selectedValue = e.target.value;
              if (selectedValue === 'novo_servico') {
                setShowNewServiceInput(true);
                onServiceTypeChange({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>);
                if (onProductClear) onProductClear();
              } else {
                setShowNewServiceInput(false);
                console.log('Valor selecionado:', selectedValue);
                onServiceTypeChange(e);

                // Verifica se o novo tipo de serviço usa produto
                const treatmentTypes = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_com_gel'];
                const isProductService = treatmentTypes.includes(selectedValue.toLowerCase()) || selectedValue.toLowerCase() === 'monitoramento';

                // Se o tipo de serviço não usa produto, limpa a seleção de produto
                if (!isProductService) {
                  if (onProductClear) onProductClear();
                }
              }
            }}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            required
          >
            <option value="">Selecione o tipo de serviço</option>
            {availableServiceTypes.map(type => {
              // Garantir que o valor seja exatamente como esperado
              const value = type.toLowerCase()
                .replace(/ç/g, 'c')
                .replace(/ã/g, 'a')
                .replace(/õ/g, 'o')
                .replace(/á/g, 'a')
                .replace(/é/g, 'e')
                .replace(/í/g, 'i')
                .replace(/ó/g, 'o')
                .replace(/ú/g, 'u')
                .replace(/ /g, '_');
              console.log('Opção:', type, 'Valor gerado:', value);
              return (
                <option key={type} value={value}>{type}</option>
              );
            })}
            <option value="novo_servico">+ Adicionar novo serviço</option>
          </select>

          {showNewServiceInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                 onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewServiceType();
                  }
                }}
                placeholder="Digite o novo tipo de serviço"
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                onClick={handleAddNewServiceType}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setNewService('');
                  setShowNewServiceInput(false);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Lista de tipos de serviço adicionados dinamicamente com botão de remover - SEMPRE VISÍVEL SE HOUVER TIPOS ADICIONADOS */}
          {availableServiceTypes.length > initialServiceTypes.length && (
             <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Tipos de serviço adicionados dinamicamente:</p>
              <ul className="space-y-2">
                {availableServiceTypes
                  .filter(type => !initialServiceTypes.includes(type)) // Filtra apenas os tipos não iniciais
                  .map(type => (
                    <li key={type} className="flex justify-between items-center text-base text-gray-700 bg-white p-3 rounded-md shadow-sm border border-gray-200">
                      <span>{type}</span>
                      <button
                        onClick={() => handleRemoveServiceType(type)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remover tipo de serviço"
                      >
                         <Trash2 size={18} />
                      </button>
                    </li>
                  ))
                }
              </ul>
            </div>
          )}

        </div>

        {/* Campo Praga Alvo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Praga Alvo *
          </label>
          <select
            value={targetPest}
            onChange={(e) => {
              if (e.target.value === 'nova_praga') {
                setShowNewPestInput(true);
                onTargetPestChange(''); // Limpa a seleção atual ao escolher adicionar nova
              } else {
                setShowNewPestInput(false); // Oculta o input de nova praga ao selecionar uma existente
                onTargetPestChange(e.target.value);
              }
            }}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            required
          >
            <option value="">Selecione a praga alvo</option>
            {availablePests.map(pest => (
              <option key={pest} value={pest.toLowerCase()}>{pest}</option>
            ))}
            <option value="nova_praga">+ Adicionar nova praga</option>
          </select>

          {showNewPestInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newPest}
                onChange={(e) => setNewPest(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddNewPest();
                  }
                }}
                placeholder="Digite a nova praga alvo"
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                onClick={handleAddNewPest}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setNewPest('');
                  setShowNewPestInput(false);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          )}
          
          {/* Lista de pragas adicionadas dinamicamente com botão de remover - SEMPRE VISÍVEL SE HOUVER PRAGAS ADICIONADAS */}
          {availablePests.length > initialPests.length && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Pragas adicionadas dinamicamente:</p>
              <ul className="space-y-2">
                {availablePests
                  .filter(pest => !initialPests.includes(pest)) // Filtra apenas as pragas não iniciais
                  .map(pest => (
                    <li key={pest} className="flex justify-between items-center text-base text-gray-700 bg-white p-3 rounded-md shadow-sm border border-gray-200">
                      <span>{pest}</span>
                      <button
                        onClick={() => handleRemovePest(pest)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remover praga"
                      >
                        <Trash2 size={18} />
                      </button>
                    </li>
                  ))
                }
              </ul>
            </div>
          )}
        </div>

        {/* Campo Local */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Local *
          </label>
          <LocationSelector
            value={location}
            onChange={onLocationChange}
          />
        </div>

        {/* Seleção de Produto */}
        {showProductSelector && (
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Foram utilizados produtos?</h4>
            <ProductSelector onProductSelect={onProductSelect} />
          </div>
        )}

        {/* Campo Quantidade de Produto */}
        {state.selectedProduct && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade de Produto ({state.selectedProduct.quantity})
            </label>
            <div className="relative">
              <input
                type="number"
                value={productAmount}
                onChange={(e) => onProductAmountChange(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm pr-16"
                placeholder={`Digite a quantidade em ${state.selectedProduct.quantity}`}
              />
              <div className="absolute inset-y-0 right-0 mt-1 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">{state.selectedProduct.quantity}</span>
              </div>
            </div>
          </div>
        )}

        {/* Grid de seletores */}
        {!isTreatmentService && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex space-x-2">
              <button
                onClick={onOpenDeviceModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-4"
              >
                Selecionar Dispositivos
              </button>
              <button
                onClick={() => setShowPestCountingModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-4"
              >
                Contagem de Pragas
              </button>
            </div>
          </div>
        )}

        {/* Campo de Observações */}
        <div className="mb-4">
          <label
            htmlFor="observations"
            className="block text-lg font-semibold text-gray-700 mb-2"
          >
            Observações
          </label>
          <textarea
            id="observations"
            value={observations}
            onChange={(e) => onObservationsChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
            rows={3}
            placeholder="Digite as observações aqui..."
          />
        </div>

        {startTime && !endTime && (
          <div className="text-green-600 font-medium mb-4">
            OS em andamento - Iniciada às {startTime.toLocaleTimeString()}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => {
              // Verifica se os campos obrigatórios estão preenchidos
              if (serviceType && targetPest && location) {
                // Adiciona o serviço atual à lista e cria um novo serviço vazio
                addNewService();
                
                // Limpa todos os campos do formulário
                onServiceTypeChange({ target: { value: '' } } as React.ChangeEvent<HTMLSelectElement>);
                onTargetPestChange('');
                onLocationChange('');
                onApplicationMethodChange('');
                onProductAmountChange('');
                onObservationsChange('');
                onProductSelect(null);
                
                // Exibe mensagem de sucesso
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
                toast.textContent = 'Serviço adicionado com sucesso!';
                document.body.appendChild(toast);
                setTimeout(() => {
                  document.body.removeChild(toast);
                }, 3000);
              } else {
                // Exibe mensagem de erro
                const toast = document.createElement('div');
                toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-md shadow-lg z-50';
                toast.textContent = 'Preencha os campos obrigatórios: Tipo de Serviço, Praga Alvo e Local';
                document.body.appendChild(toast);
                setTimeout(() => {
                  document.body.removeChild(toast);
                }, 3000);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Salvar Serviço
          </button>
          <button
            onClick={() => {
              setPestCounts([]);
              localStorage.removeItem('pestCounts');
              onFinishOS();
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50 flex items-center gap-2"
            disabled={!canFinishOS()}
          >
            <CheckCircle className="h-5 w-5" />
            {isLoading ? (
              <span>Finalizando...</span>
            ) : (
              <span>Finalizar OS</span>
            )}
          </button>
          <button
            onClick={onApproveOS}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
          >
            <ThumbsUp className="h-5 w-5" />
            Aprovar OS
          </button>
        </div>
      </div>

      {/* Modal de OS Retroativa */}
      {showRetroactiveModal && (
        <RetroactiveServiceModal
          isOpen={showRetroactiveModal}
          onClose={() => setShowRetroactiveModal(false)}
          onSave={handleRetroactiveData}
        />
      )}

      {/* Modal de Contagem de Pragas */}
      <PestCountingModal
        isOpen={showPestCountingModal}
        onClose={() => setShowPestCountingModal(false)}
        devices={
          (state.savedDevices || []).filter((device: any) =>
            !(
              device.status &&
              (Array.isArray(device.status)
                ? device.status.includes('Conforme')
                : device.status === 'Conforme')
            )
          )
        }
        onSavePestCounts={handleSavePestCounts}
        savedPestCounts={pestCounts}
      />

      {/* Modal de Dispositivos */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">Selecionar Dispositivos</h2>
              <button
                onClick={onCloseDeviceModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {/* Seletor de Dispositivo primeiro */}
              <div className="mb-6">
                <DeviceSelector
                  selectedDevice={state.selectedDevice}
                  onDeviceChange={onDeviceChange}
                  disabled={isLoading}
                />
              </div>

              {/* Status do Dispositivo */}
              <div className="mb-6">
                <StatusSelector
                  selectedStatus={state.selectedStatus}
                  onStatusChange={onStatusChange}
                  onSelectAll={onSelectAll}
                  disabled={isLoading}
                  selectedDevice={state.selectedDevice}
                />
              </div>

              {/* Quantidade */}
              <div className="mb-6">
                <QuantityInput
                  quantity={state.quantity}
                  onQuantityChange={onQuantityChange}
                  selectedDevice={state.selectedDevice}
                  disabled={isLoading}
                />
              </div>

              {/* Grid de Dispositivos */}
              <DeviceGrid
                devices={state.devices || []}
                onDeviceClick={onDeviceClick}
                selectedDeviceId={state.selectedDevice ? state.selectedDevice.id : null}
              />

              {/* Dispositivos Salvos */}
              {state.savedDevices.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-medium text-gray-900 mb-3">Dispositivos Salvos</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <DeviceSummary 
                      devices={state.savedDevices} 
                      selectedProduct={state.selectedProduct} 
                    />
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={onSaveDevices}
                  disabled={!canSave}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar Dispositivos
                </button>
                <button
                  onClick={onCloseDeviceModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumo das contagens de pragas (sempre visível) */}
      {pestCounts.length > 0 && (
        <div className="mt-8 border-t pt-6">
          <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Resumo de Contagem de Pragas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pestCounts.map((item, index) => (
                <div key={index} className="bg-white p-3 rounded-md shadow-sm">
                  <h4 className="font-medium text-gray-800">{item.deviceType} {item.deviceNumber}</h4>
                  <ul className="mt-2 space-y-1">
                    {item.pests.map((pest, pestIndex) => (
                      <li key={pestIndex} className="text-sm text-gray-600 flex justify-between">
                        <span>{pest.name}</span>
                        <span className="font-medium">{pest.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceActivity;
