import { useState, useEffect } from 'react';

export default function Logo({ 
  width = 120, 
  height = 40, 
  variant = 'primary', // 'primary' | 'white' | 'dark'
  showText = true,
  className = ''
}) {
  const [logoUrl, setLogoUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Cargar logo personalizado desde localStorage o config
    const customLogo = localStorage.getItem('app_logo_url');
    if (customLogo) {
      setLogoUrl(customLogo);
    }
  }, []);

  const getSvg = () => {
    const colors = {
      primary: { bg: '#5E244E', text: '#FFE8B4', accent: '#AA1C41' },
      white: { bg: '#FFFFFF', text: '#5E244E', accent: '#FFE8B4' },
      dark: { bg: '#1A1A1A', text: '#FFE8B4', accent: '#AA1C41' },
    };
    
    const c = colors[variant] || colors.primary;
    
    return (
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 300 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.bg} />
            <stop offset="100%" stopColor={c.accent} />
          </linearGradient>
        </defs>
        
        {/* Fondo redondeado */}
        <rect width="300" height="100" rx="16" fill="url(#grad)"/>
        
        {/* Icono de moto/entrega */}
        <g transform="translate(20, 15)">
          <circle cx="35" cy="35" r="30" fill={c.text} opacity="0.2"/>
          <path d="M20 50 L25 30 L45 30 L50 50" stroke={c.accent} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="25" cy="50" r="8" fill={c.accent}/>
          <circle cx="45" cy="50" r="8" fill={c.accent}/>
          <circle cx="25" cy="50" r="4" fill={c.text}/>
          <circle cx="45" cy="50" r="4" fill={c.text}/>
        </g>
        
        {/* Texto */}
        {showText && (
          <g transform="translate(85, 40)">
            <text 
              x="0" y="0" 
              fontFamily="Poppins, sans-serif" 
              fontSize="28" 
              fontWeight="700" 
              fill={c.text}
              letterSpacing="1"
            >
              GoPalermo
            </text>
          </g>
        )}
        
        {/* Elemento decorativo - velocidad */}
        <g transform="translate(240, 60)" opacity="0.6">
          <path d="M0 10 L15 0 L30 10" stroke={c.text} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M0 20 L15 10 L30 20" stroke={c.text} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
      </svg>
    );
  };

  if (error || !logoUrl) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {getSvg()}
      </div>
    );
  }

return (
      <img 
        src={logoUrl} 
        alt="GoPalermo" 
        width={width} 
        height={height}
        style={{ objectFit: 'contain' }}
        className={className}
      />
    );
}