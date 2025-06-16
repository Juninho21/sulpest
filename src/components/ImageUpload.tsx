import React, { useState, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';

interface ImageUploadProps {
  onFileSelect: (file: File) => void;
  currentImageUrl?: string;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onFileSelect, 
  currentImageUrl,
  className = ''
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when currentImageUrl changes
  useEffect(() => {
    if (currentImageUrl) {
      setPreviewUrl(currentImageUrl);
    }
  }, [currentImageUrl]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar o tipo do arquivo
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione apenas arquivos de imagem.');
        return;
      }

      // Validar o tamanho do arquivo (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('O arquivo é muito grande. O tamanho máximo permitido é 2MB.');
        return;
      }

      // Criar preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Chamar callback
      onFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors ${className}`}
         onClick={handleClick}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      {previewUrl ? (
        <div className="relative group">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-32 mx-auto object-contain"
          />
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={handleClick}
          >
            <span className="text-white bg-black bg-opacity-60 rounded px-2 py-1 text-xs">Trocar logo</span>
          </div>
        </div>
      ) : (
        <div 
          className="flex flex-col items-center justify-center py-4"
        >
          <span className="font-semibold text-gray-500 border border-dashed border-gray-300 rounded px-4 py-2">Logo da empresa</span>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG até 2MB</p>
        </div>
      )}
    </div>
  );
};
