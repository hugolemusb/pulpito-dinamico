#!/bin/bash
# ============================================
# PÚLPITO DINÁMICO - Versión 19 Diciembre 2025
# ============================================
# Doble clic en este archivo para abrir la app

cd "$(dirname "$0")"

echo "🚀 Iniciando Púlpito Dinámico..."
echo ""

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias (primera vez)..."
    npm install
fi

echo "✅ Abriendo en el navegador..."
echo "   http://localhost:3000"
echo ""
echo "⚠️  Para detener: Cierra esta ventana o presiona Ctrl+C"
echo ""

# Abrir Chrome después de 2 segundos
(sleep 2 && open -a "Google Chrome" "http://localhost:3000") &

# Iniciar servidor
npm run dev
