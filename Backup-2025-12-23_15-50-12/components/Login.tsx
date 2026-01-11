
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { Language } from '../types';
import { Button } from './Button';
import { Lock, Mail, User, ArrowRight, Eye, EyeOff, Sparkles } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t, language, setLanguage } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load saved email if remember me was checked
  useEffect(() => {
    sessionStorage.removeItem('LOCKED_LANGUAGE');
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (mode === 'forgot') {
      setLoading(true);
      setTimeout(() => {
        alert(`📧 Se ha enviado un enlace de recuperación a ${email}`);
        setMode('login');
        setLoading(false);
      }, 1000);
      return;
    }

    if (!password) return;
    if (mode === 'register' && !name) return;

    setLoading(true);

    // Save email if remember me is checked
    if (rememberMe) {
      localStorage.setItem('remembered_email', email);
    } else {
      localStorage.removeItem('remembered_email');
    }

    // ADMIN BYPASS LOGIC
    if (email === 'admin@verdadviva.com' && password === 'admin123') {
      setTimeout(() => {
        alert(t('login.admin_success'));
        sessionStorage.setItem('LOCKED_LANGUAGE', language);
        setLoading(false);
        onLogin();
      }, 800);
      return;
    }

    // Simulate API call for normal user
    setTimeout(() => {
      sessionStorage.setItem('LOCKED_LANGUAGE', language);
      setLoading(false);
      onLogin();
    }, 1200);
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setTimeout(() => {
      sessionStorage.setItem('LOCKED_LANGUAGE', language);
      setLoading(false);
      onLogin();
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-xl mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Púlpito Dinámico</h1>
          <p className="text-blue-200/70 text-sm mt-1">Tu asistente para predicación poderosa</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">

          {/* Language Selection - Compact */}
          <div className="flex justify-center gap-2 pt-6 pb-4 px-6">
            {[
              { code: 'es' as Language, flag: '🇪🇸', name: 'ES' },
              { code: 'en' as Language, flag: '🇬🇧', name: 'EN' },
              { code: 'pt' as Language, flag: '🇧🇷', name: 'PT' }
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all ${language === lang.code
                    ? 'bg-white text-blue-700 shadow-lg scale-105 font-bold'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
              >
                <span>{lang.flag}</span>
                <span className="text-xs">{lang.name}</span>
              </button>
            ))}
          </div>

          {/* Form Section */}
          <div className="p-8 pt-4">
            {/* Mode Title */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white">
                {mode === 'login' && t('login.title_login')}
                {mode === 'register' && t('login.title_register')}
                {mode === 'forgot' && 'Recuperar Contraseña'}
              </h2>
              <p className="text-blue-200/60 text-sm mt-1">
                {mode === 'login' && t('login.subtitle_login')}
                {mode === 'register' && t('login.subtitle_register')}
                {mode === 'forgot' && 'Ingresa tu correo para recibir instrucciones'}
              </p>
            </div>

            {/* Google Login Button - Only show on login/register */}
            {mode !== 'forgot' && (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continuar con Google
                </button>

                <div className="relative flex py-4 items-center">
                  <div className="flex-grow border-t border-white/20"></div>
                  <span className="flex-shrink-0 mx-4 text-xs text-white/40 uppercase">{t('login.divider')}</span>
                  <div className="flex-grow border-t border-white/20"></div>
                </div>
              </>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field - only for registration */}
              {mode === 'register' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">{t('login.name')}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                      placeholder="Tu nombre completo"
                      required
                    />
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">{t('login.email')}</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                </div>
              </div>

              {/* Password - not for forgot mode */}
              {mode !== 'forgot' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">{t('login.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-12 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/30 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all"
                      placeholder="••••••••"
                      required
                    />
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember me & Forgot password - only on login */}
              {mode === 'login' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500 focus:ring-blue-400 focus:ring-offset-0"
                    />
                    <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">Recordarme</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                loading={loading}
                className="w-full py-3.5 text-base font-bold mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
              >
                {mode === 'login' && <>{t('login.button_login')} <ArrowRight className="w-4 h-4 ml-2" /></>}
                {mode === 'register' && <>{t('login.button_register')} <ArrowRight className="w-4 h-4 ml-2" /></>}
                {mode === 'forgot' && <>Enviar Enlace <Mail className="w-4 h-4 ml-2" /></>}
              </Button>
            </form>

            {/* Mode Toggle Links */}
            <div className="text-center pt-6 space-y-2">
              {mode === 'login' && (
                <p className="text-sm text-white/60">
                  ¿Eres nuevo? {' '}
                  <button
                    onClick={() => { setMode('register'); setPassword(''); setName(''); }}
                    className="font-bold text-blue-300 hover:text-blue-200 transition-colors underline-offset-2 hover:underline"
                  >
                    Crear cuenta
                  </button>
                </p>
              )}
              {mode === 'register' && (
                <p className="text-sm text-white/60">
                  ¿Ya tienes cuenta? {' '}
                  <button
                    onClick={() => { setMode('login'); setPassword(''); setName(''); }}
                    className="font-bold text-blue-300 hover:text-blue-200 transition-colors underline-offset-2 hover:underline"
                  >
                    Iniciar sesión
                  </button>
                </p>
              )}
              {mode === 'forgot' && (
                <p className="text-sm text-white/60">
                  <button
                    onClick={() => setMode('login')}
                    className="font-bold text-blue-300 hover:text-blue-200 transition-colors underline-offset-2 hover:underline"
                  >
                    ← Volver al inicio
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-xs mt-6">
          © 2024 Púlpito Dinámico · Preparando la Palabra
        </p>
      </div>
    </div>
  );
};
