
import React, { useState, useEffect } from 'react';
import { Share2, Check, X, ExternalLink, ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { socialAuthService, SocialAccount, SocialPlatform } from '../../services/socialAuth';

interface LiveStreamConfigProps {
    isOpen: boolean;
    onClose: () => void;
    userPlan: string; // 'trial' | 'basic' | 'mid' | 'premium'
}

export const LiveStreamConfig: React.FC<LiveStreamConfigProps> = ({ isOpen, onClose, userPlan }) => {
    const [accounts, setAccounts] = useState<SocialAccount[]>([]);
    const [loading, setLoading] = useState(false);

    // Check if user has access (Mid+)
    const hasAccess = ['mid', 'premium'].includes(userPlan);

    useEffect(() => {
        if (isOpen && hasAccess) {
            loadAccounts();
        }
    }, [isOpen, hasAccess]);

    const loadAccounts = async () => {
        setLoading(true);
        const data = await socialAuthService.getConnectedAccounts();
        setAccounts(data);
        setLoading(false);
    };

    const isConnected = (platform: SocialPlatform) => accounts.some(a => a.platform === platform && a.connected);

    const handleConnect = async (platform: SocialPlatform) => {
        // In a real app, this would open a popup to the platform's OAuth URL.
        // For this implementation, we simulate the flow or redirect to our test page logic if needed.
        // Since we implemented the logic in the HTML test page for demonstration, 
        // we will call the mock service "save" directly here to simulate a successful return from OAuth.

        const confirmConnect = confirm(`[MOCK OAUTH]\n\nRedirigiendo a ${platform.toUpperCase()} para autorizar...`);
        if (!confirmConnect) return;

        try {
            setLoading(true);

            // Generate mock tokens (in real flow this comes from callback code exchange)
            const mockAccess = `live_token_${platform}_${Date.now()}`;
            const mockRefresh = `refresh_${platform}_${Date.now()}`;

            await socialAuthService.saveAccountConnection(
                platform,
                mockAccess,
                mockRefresh,
                60 * 60 * 24 * 60, // 60 days
                ['publish_video', 'read_insights']
            );

            await loadAccounts();
        } catch (e) {
            alert("Error al conectar cuenta: " + e);
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = async (platform: SocialPlatform) => {
        if (confirm(`¿Desconectar ${platform}? Se perderá la configuración de transmisión.`)) {
            setLoading(true);
            await socialAuthService.disconnectAccount(platform);
            await loadAccounts();
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                            <Share2 size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Canales de Transmisión</h2>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Configuración Multistreaming</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">

                    {!hasAccess ? (
                        <div className="text-center py-12 px-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <div className="inline-flex p-4 bg-amber-100 text-amber-600 rounded-full mb-4">
                                <Lock size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Función Premium</h3>
                            <p className="text-slate-500 mb-6 max-w-sm mx-auto">La transmisión en vivo multiplataforma está disponible para planes Mid y Premium.</p>
                            <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm">Entendido</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Platform Cards */}
                            {[
                                { id: 'meta', name: 'Meta (Facebook / Instagram)', icon: '♾️', color: 'bg-blue-600' },
                                { id: 'tiktok', name: 'TikTok Live', icon: '🎵', color: 'bg-black' },
                                { id: 'restream', name: 'Restream.io', icon: '📡', color: 'bg-orange-600' }
                            ].map((platform) => {
                                const connected = isConnected(platform.id as SocialPlatform);
                                return (
                                    <div key={platform.id} className="relative group transition-all hover:scale-[1.01]">
                                        <div className={`absolute inset-0 bg-gradient-to-r ${connected ? 'from-green-500/20 to-emerald-500/20' : 'from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-800'} rounded-2xl -z-10`} />
                                        <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-900/80 backend-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 flex items-center justify-center text-xl rounded-xl text-white shadow-lg ${platform.color} ${connected ? 'ring-2 ring-offset-2 ring-green-500' : 'opacity-90 grayscale'}`}>
                                                    {platform.icon}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{platform.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {connected ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase tracking-widest">
                                                                <Check size={10} strokeWidth={4} /> Conectado
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Desconectado
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => connected ? handleDisconnect(platform.id as SocialPlatform) : handleConnect(platform.id as SocialPlatform)}
                                                disabled={loading}
                                                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${connected
                                                        ? 'bg-white border-2 border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
                                                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20'
                                                    }`}
                                            >
                                                {loading ? '...' : (connected ? 'Desconectar' : 'Conectar Cuenta')}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Actions Footer */}
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                                    <ShieldCheck size={14} className="text-green-500" />
                                    Tus credenciales se almacenan encriptadas de forma segura.
                                </p>
                                <button
                                    className={`px-8 py-3 rounded-2xl font-black text-white shadow-xl transition-all flex items-center gap-3 ${accounts.filter(a => a.connected).length >= 2
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-105 active:scale-95 cursor-pointer'
                                            : 'bg-slate-300 dark:bg-slate-800 cursor-not-allowed opacity-70'
                                        }`}
                                    disabled={accounts.filter(a => a.connected).length < 2}
                                >
                                    {accounts.filter(a => a.connected).length >= 2 ? (
                                        <>
                                            <ExternalLink size={18} />
                                            INICIAR TRANSMISIÓN
                                        </>
                                    ) : (
                                        <>
                                            Conecta al menos 2 canales
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
