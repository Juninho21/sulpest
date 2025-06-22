import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md',
  showText = false 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-12 w-auto',
    lg: 'h-16 w-auto',
    xl: 'h-24 w-auto'
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Erro ao carregar logo:', e);
    const target = e.target as HTMLImageElement;
    target.style.display = 'none';
    
    // Criar fallback de texto
    const textLogo = document.createElement('h1');
    textLogo.className = `mx-auto text-2xl font-bold text-blue-600 ${size === 'xl' ? 'text-3xl' : size === 'lg' ? 'text-2xl' : 'text-xl'} mb-4`;
    textLogo.textContent = 'Sulpest';
    target.parentNode?.insertBefore(textLogo, target);
  };

  return (
    <div className={`text-center ${className}`}>
      <img
        className={`mx-auto ${sizeClasses[size]}`}
        src="https://badyvhzrjbemyqzeqlaw.supabase.co/storage/v1/object/public/images//Sulpest.png"
        alt="Sulpest Logo"
        onError={handleImageError}
      />
      {showText && (
        <h2 className="mt-2 text-lg font-semibold text-gray-700">
          Sulpest
        </h2>
      )}
    </div>
  );
};

export default Logo; 