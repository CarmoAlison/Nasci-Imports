import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import FormField from './FormField';

export default function PasswordField({ className = '', ...props }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className={`password-field ${className}`}>
      <FormField type={visivel ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {visivel ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
