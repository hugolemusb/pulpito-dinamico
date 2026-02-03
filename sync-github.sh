#!/bin/bash

# Script de respaldo automático para Púlpito Dinámico v11.9.4
# Ejecutar cuando tengas conexión estable a GitHub

echo "🚀 Iniciando sincronización con GitHub..."
echo ""

# Navegar al directorio
cd /Users/hl/Desktop/pulpito-dinamico-v11.9.4-print-removed

# Verificar conexión
echo "📡 Verificando conexión a GitHub..."
if ! git ls-remote origin &>/dev/null; then
    echo "❌ Error: No hay conexión a GitHub"
    echo "💡 Asegúrate de estar conectado a una red sin bloqueo DNS"
    echo "   (hotspot, café, otra WiFi, etc.)"
    exit 1
fi

echo "✅ Conexión OK"
echo ""

# Sincronizar con GitHub
echo "⬇️  Paso 1: Descargando cambios remotos..."
git pull origin main --rebase=false --no-edit

if [ $? -ne 0 ]; then
    echo "⚠️  Error en el pull. Revisa los conflictos si hay."
    exit 1
fi

echo "✅ Sincronización completada"
echo ""

# Subir cambios
echo "⬆️  Paso 2: Subiendo tus cambios..."
git push origin main

if [ $? -ne 0 ]; then
    echo "❌ Error al hacer push"
    exit 1
fi

echo ""
echo "✅ ¡RESPALDO COMPLETADO!"
echo "🎉 Tu código está ahora en GitHub"
echo "🚀 Vercel comenzará el despliegue automáticamente"
echo ""
echo "Revisa en: https://github.com/hugolemusb/pulpito-dinamico"
