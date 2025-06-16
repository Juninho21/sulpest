import React, { useState } from 'react';
import { PestCounter } from '../PestCounter';
import { Pest, DevicePestCount } from '../../types/pest.types';

interface DevicePestCounterProps {
  devices: Array<{
    type: string;
    number: number;
  }>;
  onSavePestCounts: (pestCounts: DevicePestCount[]) => void;
}

export const DevicePestCounter: React.FC<DevicePestCounterProps> = ({
  devices,
  onSavePestCounts
}) => {
  const [devicePestCounts, setDevicePestCounts] = useState<DevicePestCount[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Função para salvar a contagem de pragas para um dispositivo específico
  const handleSavePestCount = (deviceType: string, deviceNumber: number, pestCounts: Pest[]) => {
    const deviceIndex = devicePestCounts.findIndex(
      item => item.deviceType === deviceType && item.deviceNumber === deviceNumber
    );

    const updatedCounts = [...devicePestCounts];

    if (deviceIndex >= 0) {
      // Atualiza um dispositivo existente
      updatedCounts[deviceIndex] = {
        deviceType,
        deviceNumber,
        pests: pestCounts
      };
    } else {
      // Adiciona um novo dispositivo
      updatedCounts.push({
        deviceType,
        deviceNumber,
        pests: pestCounts
      });
    }

    setDevicePestCounts(updatedCounts);
    // Notifica o componente pai sobre a atualização
    onSavePestCounts(updatedCounts);
  };

  // Função para selecionar um dispositivo para contagem
  const handleDeviceSelect = (deviceType: string, deviceNumber: number) => {
    // Quando um novo dispositivo é selecionado, atualizamos o estado
    setSelectedDevice(`${deviceType}-${deviceNumber}`);
    
    // Verificamos se este dispositivo já tem contagens salvas
    const existingDevice = devicePestCounts.find(
      item => item.deviceType === deviceType && item.deviceNumber === deviceNumber
    );
    
    // Se não tiver contagens salvas, não precisamos fazer nada adicional
    // O componente PestCounter já vai inicializar com valores zerados através do useEffect
  };

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Contagem de Pragas por Dispositivo</h2>
      
      {/* Lista de dispositivos disponíveis */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Selecione um Dispositivo:</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {devices.map((device, index) => (
            <button
              key={`${device.type}-${device.number}-${index}`}
              onClick={() => handleDeviceSelect(device.type, device.number)}
              className={`p-2 border rounded-md text-sm ${selectedDevice === `${device.type}-${device.number}` 
                ? 'bg-blue-100 border-blue-500' 
                : 'bg-white border-gray-300 hover:bg-gray-50'}`}
            >
              {device.type} {device.number}
              {devicePestCounts.some(item => 
                item.deviceType === device.type && item.deviceNumber === device.number
              ) && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Componente de contagem para o dispositivo selecionado */}
      {selectedDevice && (() => {
        const [type, numberStr] = selectedDevice.split('-');
        const number = parseInt(numberStr, 10);
        return (
          <PestCounter
            deviceType={type}
            deviceNumber={number}
            onSave={handleSavePestCount}
          />
        );
      })()}

      {/* O resumo das contagens foi movido para o componente PestCountingModal */}
    </div>
  );
};