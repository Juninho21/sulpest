import { Client, SchedulingFilters } from '../types/scheduling';
import { Schedule } from '../types/schedule';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';

// localStorage removido - agendamentos agora são gerenciados exclusivamente pelo Supabase

export const schedulingService = {
  async createSchedule(formData: any) {
    try {
      const now = new Date().toISOString();
      const scheduleId = uuidv4();
      
      // Primeiro, criar/buscar o cliente
      let clientId = null;
      if (formData.name && formData.phone) {
        // Verificar se o cliente já existe
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('name', formData.name)
          .eq('phone', formData.phone)
          .single();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          // Criar novo cliente
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({
              id: uuidv4(),
              name: formData.name,
              phone: formData.phone,
              email: formData.email || '',
              address: formData.address || '',
              created_at: now,
              updated_at: now
            })
            .select('id')
            .single();

          if (clientError) {
            console.error('Erro ao criar cliente:', clientError);
          } else {
            clientId = newClient?.id;
          }
        }
      }

      // Salvar agendamento no Supabase
      const { error } = await supabase
        .from('schedules')
        .insert({
          id: scheduleId,
          client_id: clientId,
          client_name: formData.name,
          client_address: formData.address || '',
          date: formData.date,
          time: formData.startTime || null,
          start_time: null, // Será preenchido quando a OS for iniciada
          end_time: null,   // Será preenchido quando a OS for finalizada
          duration: formData.duration || null,
          technician: formData.technician || null,
          notes: formData.observations || null,
          status: 'pending',
          created_at: now,
          updated_at: now
        });

      if (error) {
        console.error('Erro ao salvar agendamento no Supabase:', error);
        throw error;
      }

      return scheduleId;
    } catch (error) {
      console.error('Error creating schedule:', error);
      throw error;
    }
  },

  async updateScheduleStatus(scheduleId: string, status: Client['status'], startTime?: string) {
    try {
      // Atualizar no Supabase primeiro
      const supabaseStatus = status === 'inProgress' ? 'in_progress' : 
                            status === 'completed' ? 'completed' : 
                            status === 'scheduled' ? 'pending' : 'pending';
      
      const result = await supabase
        .from('schedules')
        .update({ 
          status: supabaseStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);

      if (result.error) {
        console.error('Erro ao atualizar status no Supabase:', result.error);
      }

      return result;
    } catch (error) {
      console.error('Error updating schedule status:', error);
      throw error;
    }
  },

  async getSchedules(filters?: SchedulingFilters): Promise<Schedule[]> {
    try {
      // Buscar agendamentos do Supabase com dados do cliente
      // Adiciona timestamp para evitar cache
      const timestamp = new Date().getTime();
      const { data: supabaseSchedules, error } = await supabase
        .from('schedules')
        .select(`
          *,
          clients (
            name,
            email,
            phone,
            contact
          )
        `)
        .order('date', { ascending: true })
        .abortSignal(new AbortController().signal); // Força nova requisição

      if (error) {
        console.error('Erro ao buscar agendamentos do Supabase:', error);
        return [];
      }

      console.log('Dados brutos do Supabase:', supabaseSchedules);

      // Converter dados do Supabase para o formato Schedule correto
      let schedules: Schedule[] = (supabaseSchedules || []).map(schedule => {
        const mappedSchedule: Schedule = {
          id: schedule.id,
          clientId: schedule.client_id || '',
          clientName: schedule.client_name || schedule.clients?.name || 'Cliente não informado',
          clientAddress: schedule.client_address || '',
          clientContact: schedule.clients?.contact || '',
          clientPhone: schedule.clients?.phone || '',
          date: schedule.date,
          startTime: schedule.start_time || schedule.time || '',
          endTime: schedule.end_time || '',
          serviceType: schedule.service_type || 'default',
          status: schedule.status as Schedule['status'], // Usar o status diretamente do Supabase
          notes: schedule.notes || '',
          updatedAt: schedule.updated_at
        };
        
        console.log('Agendamento mapeado:', mappedSchedule);
        return mappedSchedule;
      });

      console.log('Agendamentos processados:', schedules);

      return this.applyFilters(schedules, filters);
    } catch (error) {
      console.error('Error getting schedules:', error);
      return [];
    }
  },

  applyFilters(schedules: Schedule[], filters?: SchedulingFilters): Schedule[] {
    if (!filters) return schedules;

    return schedules.filter(schedule => {
      let match = true;

      if (filters.status && schedule.status !== filters.status) {
        match = false;
      }

      if (filters.startDate && new Date(schedule.date) < new Date(filters.startDate)) {
         match = false;
       }

       if (filters.endDate && new Date(schedule.date) > new Date(filters.endDate)) {
         match = false;
       }

       return match;
     }).sort((a, b) => a.date.localeCompare(b.date));
   }
};
