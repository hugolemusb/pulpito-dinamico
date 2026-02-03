#!/bin/bash
# Script de Respaldo Simplificado

# Definir rutas
ORIGEN="/Users/hl/.gemini/antigravity/scratch/pulpito-dinamico-v11.9.4-print-removed"
DESTINO="$HOME/Downloads/Pulpito_Invencible_Backup.zip"

echo "=== INICIANDO RESPALDO ==="
echo "📁 Origen: $ORIGEN"
echo "💾 Destino: $DESTINO"

# Verificar origen
if [ ! -d "$ORIGEN" ]; then
    echo "❌ Error: No encuentro la carpeta del proyecto en $ORIGEN"
    exit 1
fi

# Ir al directorio
cd "$ORIGEN" || exit

# Comprimir
echo "⏳ Comprimiendo archivos (esto puede tardar unos segundos)..."
zip -r "$DESTINO" . -x "node_modules/*" ".git/*" "dist/*" > /dev/null

# Verificar resultado
if [ -f "$DESTINO" ]; then
    SIZE=$(du -h "$DESTINO" | cut -f1)
    echo "✅ ¡ÉXITO! Respaldo creado."
    echo "📍 Ubicación: Carpeta de DESCARGAS (Downloads)"
    echo "📄 Nombre: Pulpito_Invencible_Backup.zip"
    echo "⚖️ Tamaño: $SIZE"
    open -R "$DESTINO" # Esto intentará mostrar el archivo en Finder
else
    echo "❌ Error: El archivo zip no se creó."
fi
