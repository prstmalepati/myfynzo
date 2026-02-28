interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
}

const sizeMap = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  xl: 'w-14 h-14',
};

const textSizeMap = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export default function Logo({ size = 'md', showText = true, variant = 'dark', className = '' }: LogoProps) {
  const textColor = variant === 'light' ? 'text-white' : 'text-surface-900';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="myfynzo"
        className={`${sizeMap[size]} object-contain`}
        draggable={false}
      />
      {showText && (
        <span className={`font-display font-bold tracking-tight ${textSizeMap[size]} ${textColor}`}>
          myfynzo
        </span>
      )}
    </div>
  );
}
