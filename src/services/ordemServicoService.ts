import { v4 as uuidv4 } from 'uuid';
import { Schedule } from '../types/schedule';
import { ServiceOrder } from '../types/serviceOrder';
import { STORAGE_KEYS } from './storageKeys';
import { supabase } from '../config/supabase';

// Função removida - a lógica de apenas uma OS ativa é garantida pela limpeza automática

// Verifica se um agendamento específico já está em andamento (usando Supabase)
export const hasActiveSchedule = async (scheduleId: string): Promise<boolean> => {
  console.log('Verificando se o agendamento está em andamento:', scheduleId);
  try {
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('status', 'in_progress');
    
    if (error) {
      console.error('Erro ao verificar agendamento em andamento:', error);
      return false;
    }
    
    const hasActive = orders && orders.length > 0;
    console.log('Agendamento em andamento:', hasActive, 'Orders found:', orders?.length || 0);
    return hasActive;
  } catch (error) {
    console.error('Erro ao verificar agendamento em andamento:', error);
    return false;
  }
};

// Verifica se um agendamento específico já está em andamento (versão assíncrona - Supabase)
export const hasActiveScheduleAsync = async (scheduleId: string): Promise<boolean> => {
  console.log('Verificando se o agendamento está em andamento (Supabase):', scheduleId);
  try {
    // Consulta diretamente no Supabase
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('status', 'in_progress');
    
    if (error) {
      console.error('Erro ao consultar Supabase:', error);
      // Fallback para localStorage em caso de erro
      return hasActiveSchedule(scheduleId);
    }
    
    const hasActive = orders && orders.length > 0;
    console.log('Agendamento em andamento (Supabase):', hasActive, 'Orders found:', orders?.length || 0);
    
    // Dados já estão no Supabase, não precisa atualizar localStorage
    
    return hasActive;
  } catch (error) {
    console.error('Erro ao verificar agendamento em andamento (Supabase):', error);
    // Fallback para localStorage em caso de erro
    return hasActiveSchedule(scheduleId);
  }
};

// Função para obter todas as ordens de serviço (usando Supabase)
export const getAllServiceOrders = async (): Promise<ServiceOrder[]> => {
  try {
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar ordens de serviço:', error);
      return [];
    }
    
    return orders || [];
  } catch (error) {
    console.error('Erro ao obter ordens de serviço:', error);
    return [];
  }
};

// Função para obter todas as ordens de serviço
export const getServiceOrders = async (): Promise<ServiceOrder[]> => {
  return await getAllServiceOrders();
};

// Função para forçar a limpeza de ordens ativas
export const forceCleanupActiveOrders = async (): Promise<void> => {
  try {
    console.log('Iniciando limpeza forçada de ordens ativas...');
    
    // Busca todas as ordens com status 'in_progress'
    const { data: activeOrders, error: fetchError } = await supabase
      .from('service_orders')
      .select('*')
      .eq('status', 'in_progress');
    
    if (fetchError) {
      console.error('Erro ao buscar ordens ativas:', fetchError);
      return;
    }
    
    if (!activeOrders || activeOrders.length === 0) {
      console.log('Nenhuma ordem ativa encontrada.');
      return;
    }
    
    console.log(`Encontradas ${activeOrders.length} ordens ativas. Finalizando...`);
    
    // Finaliza todas as ordens ativas
    for (const order of activeOrders) {
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      
      if (updateError) {
        console.error(`Erro ao finalizar ordem ${order.id}:`, updateError);
      } else {
        console.log(`Ordem ${order.id} finalizada automaticamente.`);
      }
    }
    
    // Limpa dados relacionados do localStorage
    localStorage.removeItem('pestCounts');
    localStorage.removeItem('retroactive_service_data');
    localStorage.removeItem('serviceStartTime');
    
    console.log('Limpeza de ordens ativas concluída.');
  } catch (error) {
    console.error('Erro durante limpeza de ordens ativas:', error);
  }
};

// Função para criar uma nova OS (usando Supabase)
export const createServiceOrder = async (schedule: Schedule): Promise<ServiceOrder> => {
  console.log('Criando nova ordem de serviço para o agendamento:', schedule);

  try {
    // Obter o usuário logado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Usuário não autenticado. Não é possível criar uma Ordem de Serviço.");
    }

    // Verifica se o agendamento existe no Supabase
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('schedules')
      .select('id')
      .eq('id', schedule.id);

    if (scheduleError) {
      console.error('Erro ao consultar agendamento no Supabase:', scheduleError);
      throw new Error('Erro ao verificar agendamento no Supabase');
    }

    if (!scheduleData || scheduleData.length === 0) {
      console.log('Agendamento não encontrado no Supabase, criando...');
      // Tenta salvar o agendamento no Supabase primeiro
      const { error: insertError } = await supabase
        .from('schedules')
        .insert({
          id: schedule.id,
          client_id: null,
          client_address: schedule.clientAddress || '',
          date: schedule.date,
          time: schedule.time || null,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Erro ao salvar agendamento no Supabase:', insertError);
        throw new Error('Agendamento não encontrado e não foi possível criá-lo no Supabase');
      }
      
      console.log('Agendamento salvo no Supabase com sucesso');
    }

    // Cria a nova OS com o horário atual
    const now = new Date();
    const formattedStartTime = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const serviceOrder: ServiceOrder = {
      id: uuidv4(),
      scheduleId: schedule.id,
      clientId: schedule.clientId,
      clientName: schedule.clientName,
      clientAddress: schedule.clientAddress,
      serviceType: schedule.serviceType,
      date: schedule.date,
      startTime: formattedStartTime,
      serviceStartTime: formattedStartTime,
      endTime: '',
      status: 'in_progress' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      notes: '',
      signatures: {
        client: '',
        technician: ''
      },
      productAmount: '',
      targetPest: '',
      location: '',
      observations: '',
      applicationMethod: ''
    };

    // Salva no Supabase
    const { error } = await supabase
      .from('service_orders')
      .insert({
        id: serviceOrder.id,
        user_id: user.id,
        client_id: serviceOrder.clientId,
        schedule_id: serviceOrder.scheduleId,
        status: serviceOrder.status,
        service_type: serviceOrder.serviceType,
        target_pest: serviceOrder.targetPest || '',
        location: serviceOrder.location || '',
        observations: serviceOrder.observations || '',
        application_method: serviceOrder.applicationMethod || '',
        product_amount: serviceOrder.productAmount ? parseFloat(serviceOrder.productAmount) : null,
        start_time: now.toISOString(),
        end_time: null,
        created_at: now.toISOString()
      });
    
    if (error) {
      console.error('Erro ao salvar OS no Supabase:', error);
      throw error;
    }
    
    console.log('Nova OS criada:', serviceOrder);
    console.log('Status da OS:', serviceOrder.status);

    // Atualiza o status do agendamento para "in_progress"
    await updateScheduleStatus(schedule.id, 'in_progress');

    // Dispara evento de atualização de OS
    const updateEvent = new CustomEvent('serviceOrderUpdate', {
      detail: {
        orderId: serviceOrder.id,
        scheduleId: schedule.id,
        status: 'in_progress',
        startTime: formattedStartTime
      }
    });
    window.dispatchEvent(updateEvent);

    // Limpa dados da página de atividade antes de iniciar nova OS
    localStorage.removeItem('pestCounts');
    localStorage.removeItem('retroactive_service_data');
    
    // Dispara evento específico de início de OS
    const startEvent = new CustomEvent('serviceStart', {
      detail: {
        serviceOrder,
        startTime: now,
        clearPreviousData: true
      }
    });
    window.dispatchEvent(startEvent);
    
    // Dispara evento para limpar dados da página de atividade
    const cleanupEvent = new CustomEvent('serviceActivityCleanup', {
      detail: {
        orderId: serviceOrder.id,
        newOrder: true
      }
    });
    window.dispatchEvent(cleanupEvent);

    return serviceOrder;
  } catch (error) {
    console.error('Erro ao criar ordem de serviço:', error);
    throw error;
  }
};

// Função para registrar não atendimento
export const registerNoService = async (schedule: Schedule, reason: string): Promise<ServiceOrder> => {
  try {
    const now = new Date().toISOString();
    
    const serviceOrder: ServiceOrder = {
      id: uuidv4(),
      scheduleId: schedule.id,
      clientId: schedule.clientId,
      clientName: schedule.clientName,
      clientAddress: schedule.clientAddress,
      startTime: '',
      endTime: '',
      date: schedule.date,
      status: 'cancelled',
      noServiceReason: reason,
      createdAt: now,
      updatedAt: now
    };

    // Carrega as OS existentes
    const allOrders = getAllServiceOrders();
    
    // Adiciona a nova OS
    allOrders.push(serviceOrder);
    
    // Dados já salvos no Supabase, não precisa salvar no localStorage

    // Atualiza o status do agendamento
    await updateScheduleStatus(schedule.id, 'cancelled');

    return serviceOrder;
  } catch (error) {
    console.error('Erro ao registrar não atendimento:', error);
    throw new Error('Erro ao registrar não atendimento');
  }
};

// Função para finalizar uma ordem de serviço (usando Supabase)
export const finishServiceOrder = async (orderId: string): Promise<void> => {
  try {
    // Primeiro, força a limpeza de qualquer ordem ativa para garantir que apenas uma OS esteja ativa
    await forceCleanupActiveOrders();
    
    // Busca a ordem de serviço no Supabase
    const { data: orders, error: fetchError } = await supabase
      .from('service_orders')
      .select('*')
      .eq('id', orderId);

    if (fetchError) {
      console.error('Erro ao buscar ordem de serviço:', fetchError);
      throw new Error('Erro ao buscar ordem de serviço');
    }

    if (!orders || orders.length === 0) {
      throw new Error('Ordem de serviço não encontrada');
    }

    const order = orders[0];

    // Verifica se o campo tratamento está preenchido quando necessário
    const treatmentTypes = ['pulverizacao', 'atomizacao', 'termonebulizacao', 'polvilhamento', 'iscagem_gel'];
    if (treatmentTypes.includes(order.service_type?.toLowerCase() || '') && !order.treatment) {
      throw new Error('O campo tratamento é obrigatório para este tipo de serviço');
    }

    const now = new Date();
    const formattedEndTime = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    // Atualiza o status da OS no Supabase
    const { error: updateError } = await supabase
      .from('service_orders')
      .update({
        status: 'completed',
        end_time: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Erro ao atualizar ordem de serviço:', updateError);
      throw new Error('Erro ao finalizar ordem de serviço');
    }

    // Atualiza o status do agendamento para completed
    await updateScheduleStatus(order.schedule_id, 'completed');

    // Gera o PDF da ordem de serviço e adiciona à lista de downloads
    try {
      // Busca os dados do cliente no Supabase
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('id', order.client_id);
      
      const client = clients?.[0];
      
      // Prepara os dados para o PDF
      const pdfData = {
        orderNumber: order.id,
        date: order.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        startTime: order.start_time ? new Date(order.start_time).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) : '',
        endTime: formattedEndTime,
        client: {
          name: client?.name || '',
          address: client?.address || ''
        },
        service: {
          type: order.service_type || ''
        }
      };
      
      // Salva os dados do PDF no Supabase (tabela service_order_pdfs)
      const { error: pdfError } = await supabase
        .from('service_order_pdfs')
        .upsert({
          order_id: order.id,
          order_number: order.id,
          client_name: client?.name || '',
          service_type: order.service_type || '',
          created_at: now.toISOString()
        });
      
      if (pdfError) {
        console.error('Erro ao salvar dados do PDF:', pdfError);
      }
    } catch (error) {
      console.error('Erro ao processar dados do PDF:', error);
      // Continua a execução mesmo se houver erro ao processar o PDF
    }

    // Limpa os dados da página de atividade após finalizar a OS
    localStorage.removeItem('serviceStartTime');
    localStorage.removeItem('pestCounts');
    localStorage.removeItem('currentServiceOrder');
    localStorage.removeItem('activeServiceOrder');
    localStorage.removeItem('retroactive_service_data');
    
    // Dispara evento de atualização
    const event = new CustomEvent('serviceOrderUpdate', {
      detail: {
        orderId: orderId,
        scheduleId: order.schedule_id,
        status: 'completed',
        endTime: formattedEndTime
      }
    });
    window.dispatchEvent(event);
    
    // Dispara evento específico para limpar dados da página de atividade
    const cleanupEvent = new CustomEvent('serviceActivityCleanup', {
      detail: {
        orderId: orderId,
        success: true
      }
    });
    window.dispatchEvent(cleanupEvent);
  } catch (error) {
    console.error('Erro ao finalizar ordem de serviço:', error);
    throw error;
  }
};

// Função para finalizar todas as OS em andamento (usando Supabase)
export const finishAllActiveServiceOrders = async (): Promise<void> => {
  try {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Atualiza todas as ordens em andamento no Supabase
    const { data: updatedOrders, error } = await supabase
      .from('service_orders')
      .update({
        status: 'completed',
        end_time: currentTime,
        updated_at: now.toISOString()
      })
      .eq('status', 'in_progress')
      .select();

    if (error) {
      console.error('Erro ao finalizar ordens de serviço no Supabase:', error);
      throw new Error('Erro ao finalizar ordens de serviço');
    }

    // Atualizar o status dos agendamentos relacionados
    if (updatedOrders) {
      await Promise.all(updatedOrders.map(async (order) => {
         if (order.status === 'completed') {
           await updateScheduleStatus(order.schedule_id, 'completed');
         }
       }));
    }

    // Limpa o status dos agendamentos pendentes do dia
    clearPendingSchedules();
  } catch (error) {
    console.error('Erro ao finalizar ordens de serviço:', error);
  }
};

// Função para sincronizar status dos agendamentos com ordens de serviço (usando Supabase)
const syncScheduleStatusWithOrders = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Busca todas as OS completadas do dia
    const { data: completedOrders, error: ordersError } = await supabase
      .from('service_orders')
      .select('schedule_id')
      .eq('status', 'completed')
      .gte('created_at', today)
      .lt('created_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (ordersError) {
      console.error('Erro ao buscar ordens de serviço:', ordersError);
      return;
    }

    if (completedOrders && completedOrders.length > 0) {
      const scheduleIds = completedOrders.map(order => order.schedule_id);
      
      // Atualiza status dos agendamentos para completed
      const { error: updateError } = await supabase
        .from('schedules')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .in('id', scheduleIds)
        .eq('date', today);

      if (updateError) {
        console.error('Erro ao atualizar status dos agendamentos:', updateError);
      }
    }
  } catch (error) {
    console.error('Erro ao sincronizar status dos agendamentos:', error);
  }
};

// Função para limpar ordens de serviço antigas ou inválidas (usando Supabase)
const cleanupServiceOrders = async () => {
  console.log('Limpando ordens de serviço antigas...');
  
  try {
    // Remove ordens antigas (mais de 24 horas) do Supabase
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    const { error } = await supabase
      .from('service_orders')
      .delete()
      .or(`status.is.null,created_at.lt.${twentyFourHoursAgo.toISOString()}`);
    
    if (error) {
      console.error('Erro ao limpar ordens antigas:', error);
      return;
    }
    
    console.log('Ordens de serviço antigas removidas do Supabase');
  } catch (error) {
    console.error('Erro ao limpar ordens de serviço:', error);
  }
};

// Função para limpar todos os dados do sistema
export const cleanupSystemData = (): void => {
  try {
    // Limpa todo o localStorage
    localStorage.clear();
    
    // Limpa todo o sessionStorage
    sessionStorage.clear();
    
    // Tenta limpar o IndexedDB (usado pelo Firebase)
    const clearIndexedDB = async () => {
      try {
        const databases = await window.indexedDB.databases();
        databases.forEach(db => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      } catch (err) {
        console.warn('Não foi possível limpar o IndexedDB:', err);
      }
    };
    
    // Executa a limpeza do IndexedDB
    clearIndexedDB();
    
    // Limpa os cookies
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    });
    
    // Limpa o cache do navegador (quando possível)
    if (window.caches && window.caches.keys) {
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
    }
    
    // Dispara evento de atualização
    const event = new CustomEvent('systemCleanup');
    window.dispatchEvent(event);
    
    console.log('Sistema completamente limpo, incluindo memória do navegador');
  } catch (error) {
    console.error('Erro ao limpar sistema:', error);
    throw error;
  }
};

// Função para atualizar o status dos agendamentos do dia
export const updateDailySchedulesStatus = async (): Promise<void> => {
  console.log('Atualizando status dos agendamentos do dia...');
  
  try {
    // Pega a data atual no formato yyyy-MM-dd
    const today = new Date().toISOString().split('T')[0];
    console.log('Data atual:', today);

    // Busca os agendamentos do dia no Supabase
    const { data: todaySchedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('date', today);
    
    if (schedulesError) {
      console.error('Erro ao buscar agendamentos:', schedulesError);
      return;
    }

    if (!todaySchedules || todaySchedules.length === 0) {
      console.log('Nenhum agendamento encontrado para hoje');
      return;
    }

    console.log('Agendamentos do dia:', todaySchedules);

    // Busca as ordens de serviço do Supabase
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*');
    
    if (error) {
      console.error('Erro ao buscar ordens de serviço:', error);
      return;
    }
    
    const serviceOrders: ServiceOrder[] = orders || [];

    // Para cada agendamento do dia
    for (const schedule of todaySchedules) {
      // Verifica se já passou do horário do agendamento
      const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const isPastSchedule = schedule.endTime <= currentTime;

      // Busca a ordem de serviço relacionada
      const relatedOrder = serviceOrders.find(order => order.scheduleId === schedule.id);

      if (relatedOrder) {
        // Se tem OS relacionada, usa o status dela
        if (relatedOrder.status === 'completed' && schedule.status !== 'completed') {
          updateScheduleStatus(schedule.id, 'completed');
        } else if (relatedOrder.status === 'in_progress' && schedule.status !== 'in_progress') {
          updateScheduleStatus(schedule.id, 'in_progress');
        }
      } else if (isPastSchedule && schedule.status === 'pending') {
        // Se não tem OS e já passou do horário, marca como não atendido
        await updateScheduleStatus(schedule.id, 'cancelled');
      }
    }

    console.log('Status dos agendamentos atualizados com sucesso');

  } catch (error) {
    console.error('Erro ao atualizar status dos agendamentos:', error);
    throw error;
  }
};

// Função para atualizar o status dos agendamentos de uma data específica
export const updateSchedulesStatusByDate = async (date: string): Promise<void> => {
  console.log('Atualizando status dos agendamentos da data:', date);
  
  try {
    // Aguarda um momento para garantir que todas as atualizações anteriores foram processadas
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Busca os agendamentos da data no Supabase
    const { data: dateSchedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('*')
      .eq('date', date);
    
    if (schedulesError) {
      console.error('Erro ao buscar agendamentos:', schedulesError);
      return;
    }

    if (!dateSchedules || dateSchedules.length === 0) {
      console.log('Nenhum agendamento encontrado para a data');
      return;
    }

    console.log('Agendamentos da data:', dateSchedules);

    // Busca as ordens de serviço do Supabase
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*');
    
    if (error) {
      console.error('Erro ao buscar ordens de serviço:', error);
      return;
    }
    
    const serviceOrders: ServiceOrder[] = orders || [];
    console.log('Ordens de serviço encontradas:', serviceOrders);

    // Para cada agendamento da data
    for (const schedule of dateSchedules) {
      console.log('\nProcessando agendamento:', schedule);
      
      // Verifica se já passou do horário do agendamento
      const currentTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const isPastSchedule = schedule.endTime <= currentTime;
      console.log('Horário atual:', currentTime);
      console.log('Horário do agendamento:', schedule.endTime);
      console.log('Passou do horário?', isPastSchedule);

      // Busca a ordem de serviço relacionada
      const relatedOrder = serviceOrders.find(order => {
        const isRelated = order.scheduleId === schedule.id;
        console.log('Verificando OS:', order.id, 'scheduleId:', order.scheduleId, 'relacionada?', isRelated);
        return isRelated;
      });
      console.log('Ordem de serviço relacionada:', relatedOrder);

      let newStatus = schedule.status;
      console.log('Status atual:', schedule.status);

      if (relatedOrder) {
        console.log('Status da OS:', relatedOrder.status);
        // Se tem OS relacionada, usa o status dela
        if (relatedOrder.status === 'completed') {
          console.log('OS está concluída, atualizando agendamento para concluído');
          newStatus = 'completed';
        } else if (relatedOrder.status === 'in_progress') {
          console.log('OS está em andamento, atualizando agendamento para em andamento');
          newStatus = 'in_progress';
        }
      } else if (isPastSchedule && schedule.status === 'pending') {
        console.log('Sem OS e passou do horário, marcando como não atendido');
        newStatus = 'cancelled';
      } else if (!isPastSchedule && schedule.status === 'cancelled') {
        console.log('Sem OS e ainda não passou do horário, voltando para pendente');
        newStatus = 'pending';
      }

      console.log('Novo status:', newStatus);
      // Só atualiza se o status mudou
      if (newStatus !== schedule.status) {
        console.log('Atualizando status do agendamento...');
        await updateScheduleStatus(schedule.id, newStatus);
        // Aguarda um momento para garantir que a atualização foi processada
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log('Status não mudou, mantendo o mesmo');
      }
    }

    console.log('Status dos agendamentos atualizados com sucesso');

  } catch (error) {
    console.error('Erro ao atualizar status dos agendamentos:', error);
    throw error;
  }
};

// Função para atualizar o status dos agendamentos de uma data específica
export const updateScheduleStatus = async (scheduleId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled'): Promise<void> => {
  console.log(`Atualizando status do agendamento ${scheduleId} para ${status}`);
  
  try {
    // Atualiza no Supabase
    const { data: updatedSchedule, error } = await supabase
      .from('schedules')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar status no Supabase:', error);
      throw error;
    }

    console.log('Status atualizado no Supabase com sucesso:', updatedSchedule);

    // Dispara evento de atualização com o agendamento completo
    const eventDetail = {
      scheduleId,
      status,
      schedule: updatedSchedule,
      timestamp: new Date().toISOString()
    };
    
    const event = new CustomEvent('scheduleUpdate', {
      detail: eventDetail
    });
    
    console.log('Disparando evento scheduleUpdate com detalhes:', eventDetail);
    console.log('Evento criado:', event);
    
    // Verifica se o evento foi disparado corretamente
    const dispatched = window.dispatchEvent(event);
    console.log('Evento disparado com sucesso:', dispatched);

  } catch (error) {
    console.error('Erro ao atualizar status do agendamento:', error);
    throw error;
  }
};

// Função para aprovar uma ordem de serviço (usando Supabase)
export const approveServiceOrder = async (orderId: string): Promise<void> => {
  try {
    const now = new Date();

    // Atualiza o status da OS no Supabase
    const { error } = await supabase
      .from('service_orders')
      .update({
        status: 'approved',
        updated_at: now.toISOString()
      })
      .eq('id', orderId);

    if (error) {
      console.error('Erro ao aprovar ordem de serviço no Supabase:', error);
      throw new Error('Erro ao aprovar ordem de serviço');
    }

    // Dispara evento de atualização
    const event = new CustomEvent('serviceOrderUpdate', {
      detail: {
        orderId: orderId,
        status: 'approved'
      }
    });
    window.dispatchEvent(event);
  } catch (error) {
    console.error('Erro ao aprovar ordem de serviço:', error);
    throw error;
  }
};

// Função para obter todas as ordens de serviço finalizadas (usando Supabase)
export const getFinishedServiceOrders = async (): Promise<ServiceOrder[]> => {
  try {
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*')
      .in('status', ['completed', 'approved'])
      .not('end_time', 'is', null)
      .order('end_time', { ascending: false });
    
    if (error) {
      console.error('Erro ao buscar ordens finalizadas:', error);
      return [];
    }
    
    return orders || [];
  } catch (error) {
    console.error('Erro ao obter ordens finalizadas:', error);
    return [];
  }
};

// Função para obter a ordem de serviço ativa (usando Supabase)
export const getActiveServiceOrder = async (): Promise<ServiceOrder | null> => {
  try {
    const { data: orders, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('status', 'in_progress')
      .limit(1);
    
    if (error) {
      console.error('Erro ao buscar ordem ativa:', error);
      return null;
    }
    
    return orders?.[0] || null;
  } catch (error) {
    console.error('Erro ao obter ordem ativa:', error);
    return null;
  }
};

// Função para salvar uma ordem de serviço (usando Supabase)
export const saveServiceOrder = async (order: ServiceOrder): Promise<void> => {
  try {
    const { error } = await supabase
      .from('service_orders')
      .upsert({
        id: order.id,
        client_id: order.clientId,
        schedule_id: order.scheduleId,
        status: order.status,
        service_type: order.serviceType,
        target_pest: order.targetPest || '',
        location: order.location || '',
        observations: order.observations || '',
        application_method: order.applicationMethod || '',
        product_amount: order.productAmount ? parseFloat(order.productAmount) : null,
        start_time: order.startTime ? new Date(order.startTime).toISOString() : null,
        end_time: order.endTime ? new Date(order.endTime).toISOString() : null,
        created_at: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao salvar ordem:', error);
      throw new Error('Erro ao salvar ordem de serviço');
    }
  } catch (error) {
    console.error('Erro ao salvar ordem:', error);
    throw new Error('Erro ao salvar ordem de serviço');
  }
};

export const ordemServicoService = {
  hasActiveSchedule,
  hasActiveScheduleAsync,
  getActiveServiceOrder,
  finishAllActiveServiceOrders
};
