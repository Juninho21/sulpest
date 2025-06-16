import React, { useState, useEffect, useCallback } from 'react';
import { Calendar } from './Calendar';
import { ScheduleList } from './ScheduleList';
import { Schedule, getSchedulesByDate, saveSchedule } from '../services/localStorageService';
import { Plus, X, RefreshCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { getClients } from '../services/clientStorage';
import { Client } from '../types/client';
import { STORAGE_KEYS } from '../services/storageKeys';
import { supabase } from '../config/supabase';

const SERVICE_TYPES = [
  'Contrato',
  'Emergencial',
  'Avulso',
];

const TECHNICIANS = [
  'João Silva',
  'Maria Santos',
  'Pedro Oliveira',
  'Ana Costa'
];

const DURATION_OPTIONS = [
  '30 minutos',
  '1 hora',
  '1 hora e 30 minutos',
  '2 horas',
  '2 horas e 30 minutos',
  '3 horas',
  '3 horas e 30 minutos',
  '4 horas'
];

const TIME_SLOTS = [
  '00:00',
  '00:30',
  '01:00',
  '01:30',
  '02:00',
  '02:30',
  '03:00',
  '03:30',
  '04:00',
  '04:30',
  '05:00',
  '05:30',
  '06:00',
  '06:30',
  '07:00',
  '07:30',
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
  '21:30',
  '22:00',
  '22:30',
  '23:00',
  '23:30'
];

interface ServiceSchedulerProps {
  onTabChange: (tab: string) => void;
  onOSStart: () => void;
}

interface Client {
  id: string;
  code: string;
  name: string;
  branch: string;
  address: string;
  contact: string;
  phone: string;
  city: string;
  state: string;
  neighborhood: string;
  zip_code: string;
  email?: string;
  cnpj?: string;
}

export const ServiceScheduler: React.FC<ServiceSchedulerProps> = ({ onTabChange, onOSStart }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [schedule, setSchedule] = useState<Partial<Schedule>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '06:00',
    endTime: '17:00',
    serviceType: '',
    status: 'pending'
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);

  // Carrega os agendamentos
  const loadSchedules = useCallback(() => {
    console.log('Carregando agendamentos...');
    const savedSchedules = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    if (savedSchedules) {
      try {
        const allSchedules = JSON.parse(savedSchedules);
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        console.log('Data formatada:', formattedDate);
        console.log('Todos os agendamentos:', allSchedules);
        
        const dateSchedules = allSchedules.filter(
          (schedule: Schedule) => schedule.date === formattedDate
        );
        console.log('Agendamentos filtrados por data:', dateSchedules);
        
        const sortedSchedules = dateSchedules.sort((a: Schedule, b: Schedule) => {
          // Coloca os agendamentos concluídos por último
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          // Ordena por horário
          return a.startTime.localeCompare(b.startTime);
        });
        
        console.log('Agendamentos ordenados:', sortedSchedules);
        setSchedules(sortedSchedules);
      } catch (error) {
        console.error('Erro ao processar agendamentos:', error);
        setSchedules([]);
      }
    } else {
      console.log('Nenhum agendamento encontrado no localStorage');
      setSchedules([]);
    }
  }, [selectedDate]);

  // Função para atualizar agendamentos
  const handleScheduleUpdate = useCallback(() => {
    console.log('Atualizando lista de agendamentos...');
    loadSchedules();
  }, [loadSchedules]);

  // Carrega os clientes
  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, code, name, branch, address, contact, phone, city, state, neighborhood, zip_code');
      if (!error && data) {
        setClients(data);
      } else {
        setClients([]);
      }
    };
    fetchClients();
  }, []);

  // Carrega os agendamentos iniciais
  useEffect(() => {
    console.log('Efeito de carregamento inicial dos agendamentos');
    loadSchedules();
  }, [loadSchedules]);

  // Atualiza os agendamentos quando retornar para esta tela
  useEffect(() => {
    console.log('Configurando event listeners');
    
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Tela visível, recarregando agendamentos...');
        loadSchedules();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.SCHEDULES) {
        console.log('Storage mudou, recarregando agendamentos...');
        loadSchedules();
      }
    };

    const handleScheduleUpdate = (event: CustomEvent) => {
      console.log('ServiceScheduler recebeu evento scheduleUpdate:', event.detail);
      const { scheduleId, status, schedule } = event.detail;
      
      // Atualiza o estado local se o agendamento estiver na lista atual
      setSchedules(prevSchedules => {
        const scheduleIndex = prevSchedules.findIndex(s => s.id === scheduleId);
        if (scheduleIndex === -1) return prevSchedules;

        const newSchedules = [...prevSchedules];
        newSchedules[scheduleIndex] = {
          ...newSchedules[scheduleIndex],
          ...schedule,
          status
        };

        console.log('Agendamentos atualizados localmente:', newSchedules);
        return newSchedules;
      });

      // Força uma atualização do localStorage também
      loadSchedules();
    };

    const handleServiceOrderUpdate = (event: CustomEvent) => {
      console.log('ServiceScheduler recebeu evento serviceOrderUpdate:', event.detail);
      const { scheduleId, status } = event.detail;
      if (scheduleId && status) {
        // Atualiza o estado local se o agendamento estiver na lista atual
        setSchedules(prevSchedules => {
          const scheduleIndex = prevSchedules.findIndex(s => s.id === scheduleId);
          if (scheduleIndex === -1) return prevSchedules;

          const newSchedules = [...prevSchedules];
          newSchedules[scheduleIndex] = {
            ...newSchedules[scheduleIndex],
            status
          };

          console.log('Agendamentos atualizados localmente:', newSchedules);
          return newSchedules;
        });

        // Força uma atualização do localStorage também
        loadSchedules();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('scheduleUpdate', handleScheduleUpdate as EventListener);
    window.addEventListener('serviceOrderUpdate', handleServiceOrderUpdate as EventListener);

    // Carrega os agendamentos imediatamente
    loadSchedules();

    return () => {
      console.log('Removendo event listeners');
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('scheduleUpdate', handleScheduleUpdate as EventListener);
      window.removeEventListener('serviceOrderUpdate', handleServiceOrderUpdate as EventListener);
    };
  }, [loadSchedules]);

  useEffect(() => {
    console.log('Forçando atualização quando houver mudança de status');
    loadSchedules();
  }, [schedule.status]);

  const handleDateChange = (date: Date) => {
    console.log('Data selecionada mudou para:', date);
    setSelectedDate(date);
    const formattedDate = format(date, 'yyyy-MM-dd');
    setSchedule(prev => ({ ...prev, date: formattedDate }));
  };

  const handleClientSelect = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setSelectedClient(client);
      setSchedule(prev => ({
        ...prev,
        clientId: client.id,
        client_address: `${client.address}, ${client.city} - ${client.state}`
      }));
    }
  };

  const handleEditSchedule = (scheduleToEdit: Schedule) => {
    // Carrega os dados do agendamento no formulário
    setSchedule(scheduleToEdit);
    
    // Encontra e seleciona o cliente
    const client = clients.find(c => c.id === scheduleToEdit.clientId);
    if (client) {
      setSelectedClient(client);
    }
    
    // Abre o modal
    setShowForm(true);
  };

  const handleDeleteSchedule = (scheduleToDelete: Schedule) => {
    if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
      // Carrega todos os agendamentos
      const savedSchedules = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
      const allSchedules = savedSchedules ? JSON.parse(savedSchedules) : [];
      
      // Remove o agendamento selecionado
      const updatedSchedules = allSchedules.filter(
        (schedule: Schedule) => schedule.id !== scheduleToDelete.id
      );
      
      // Salva a lista atualizada
      localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(updatedSchedules));

      // Recarrega a lista de agendamentos
      loadSchedules();
      
      toast.success('Agendamento excluído com sucesso!');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClient) {
      toast.error('Por favor, selecione um cliente');
      return;
    }

    if (!schedule.serviceType) {
      toast.error('Por favor, selecione o tipo de serviço');
      return;
    }

    if (!schedule.startTime || !schedule.endTime) {
      toast.error('Por favor, selecione os horários de início e fim');
      return;
    }

    // Validar se horário de fim é depois do início
    if (schedule.startTime >= schedule.endTime) {
      toast.error('O horário de fim deve ser depois do horário de início');
      return;
    }

    // Se já existe um ID, é uma edição
    const isEditing = Boolean(schedule.id);
    
    const scheduleData: Schedule = {
      id: schedule.id || uuidv4(),
      client_id: selectedClient.id,
      client_address: `${selectedClient.address}, ${selectedClient.city} - ${selectedClient.state}`,
      date: schedule.date!,
      startTime: schedule.startTime as string,
      endTime: schedule.endTime as string,
      serviceType: schedule.serviceType!,
      status: (schedule.status as 'pending' | 'in_progress' | 'completed' | 'cancelled') || 'pending'
    };

    // Carrega agendamentos existentes
    const savedSchedules = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    const allSchedules = savedSchedules ? JSON.parse(savedSchedules) : [];

    // Verifica se já existe agendamento no mesmo horário
    const hasConflict = allSchedules.some((existingSchedule: Schedule) => {
      // Ignora o próprio agendamento em caso de edição
      if (isEditing && existingSchedule.id === schedule.id) {
        return false;
      }

      // Verifica se é no mesmo dia
      if (existingSchedule.date !== schedule.date) {
        return false;
      }

      // Verifica se há sobreposição de horários
      const newStart = schedule.startTime;
      const newEnd = schedule.endTime;
      const existingStart = existingSchedule.startTime;
      const existingEnd = existingSchedule.endTime;

      return (
        (newStart >= existingStart && newStart < existingEnd) || // Novo início durante agendamento existente
        (newEnd > existingStart && newEnd <= existingEnd) || // Novo fim durante agendamento existente
        (newStart <= existingStart && newEnd >= existingEnd) // Novo agendamento engloba existente
      );
    });

    if (hasConflict) {
      toast.error('Já existe um agendamento neste horário');
      return;
    }
    
    if (isEditing) {
      // Atualiza o agendamento existente
      const scheduleIndex = allSchedules.findIndex((s: Schedule) => s.id === schedule.id);
      if (scheduleIndex !== -1) {
        allSchedules[scheduleIndex] = scheduleData;
      }
    } else {
      // Adiciona novo agendamento
      allSchedules.push(scheduleData);
    }
    
    // Salva no localStorage
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(allSchedules));

    // Limpa o formulário
    setSelectedClient(null);
    setSchedule({
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '06:00',
      endTime: '17:00',
      serviceType: '',
      status: 'pending'
    });

    // Fecha o modal e recarrega os agendamentos
    setShowForm(false);
    loadSchedules();
    
    toast.success(isEditing ? 'Agendamento atualizado com sucesso!' : 'Agendamento salvo com sucesso!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold mb-4">Agenda</h1>
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={() => {
              setSelectedClient(null);
              setSchedule({
                date: format(new Date(), 'yyyy-MM-dd'),
                startTime: '06:00',
                endTime: '17:00',
                serviceType: '',
                status: 'pending'
              });
              setShowForm(true);
            }}
            className="min-w-[160px] bg-[#00A651] hover:bg-[#008c44] text-white font-semibold py-2.5 px-4 rounded-md flex items-center justify-center gap-2 transition-colors duration-200"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 sticky top-8">
            <Calendar onDateSelect={handleDateChange} selectedDate={selectedDate} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <ScheduleList
            schedules={schedules}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onScheduleClick={handleEditSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onScheduleUpdate={handleScheduleUpdate}
            onOSStart={onOSStart}
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">
                {schedule.clientName ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Fechar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo de seleção de cliente */}
              <div>
                <label htmlFor="client" className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente
                </label>
                <select
                  id="client"
                  name="client"
                  value={selectedClient?.id || ''}
                  onChange={(e) => handleClientSelect(e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.address}, {client.city} - {client.state}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClient && (
                <div className="bg-gray-50 rounded-md p-4">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Dados do Cliente</h3>
                  <p className="text-sm text-gray-900">{selectedClient.name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedClient.address}, {selectedClient.city} - {selectedClient.state}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Tel: {selectedClient.phone}</p>
                  <p className="text-sm text-gray-600 mt-1">Contato: {selectedClient.contact}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Serviço
                </label>
                <select
                  value={schedule.serviceType}
                  onChange={(e) => setSchedule(prev => ({ ...prev, serviceType: e.target.value }))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  required
                >
                  <option value="">Selecione o serviço</option>
                  {SERVICE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data
                  </label>
                  <input
                    type="date"
                    value={schedule.date}
                    onChange={(e) => setSchedule(prev => ({ ...prev, date: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Início
                    </label>
                    <select
                      value={schedule.startTime}
                      onChange={(e) => setSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      required
                    >
                      {TIME_SLOTS.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de Fim
                    </label>
                    <select
                      value={schedule.endTime}
                      onChange={(e) => setSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      required
                    >
                      {TIME_SLOTS.map(time => (
                        <option key={time} value={time}>{time}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
