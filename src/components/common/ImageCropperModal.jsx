import { useState } from 'react';
import Cropper from 'react-easy-crop';
import { Check, X, ZoomIn } from 'lucide-react';
import { getCroppedImageDataUrl } from '../../utils/cropImage';

// Recorte interactivo ligero para el escudo del club (Paso 1 del asistente de bienvenida):
// marco de encuadre cuadrado centrado, slider de zoom y arrastre libre de la imagen dentro del
// marco (gestos de react-easy-crop, con soporte táctil real ya resuelto por la propia
// librería — mucho más fiable en móvil que reimplementar el drag/zoom a mano). "imageSrc" es
// la imagen ORIGINAL sin redimensionar (ver readFileAsDataUrl), para poder hacer zoom con
// calidad; el resultado final se exporta ya cuadrado y comprimido (ver getCroppedImageDataUrl).
export default function ImageCropperModal({ imageSrc, onCancel, onApply }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    if (!croppedAreaPixels || isProcessing) return;
    setIsProcessing(true);
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedAreaPixels);
      onApply(dataUrl);
    } catch (err) {
      console.error('Error recortando el escudo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div className="bg-surface border border-border rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 pt-5 pb-3">
          <h3 className="font-black italic text-green-500 text-sm uppercase">Encuadra tu Escudo</h3>
          <button type="button" onClick={onCancel} className="p-1 text-fg-faint hover:text-fg transition-colors"><X size={18} /></button>
        </div>
        <div className="relative w-full h-72 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
          />
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <ZoomIn size={16} className="text-fg-faint shrink-0" />
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-green-500" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-xl bg-well-strong text-fg font-black uppercase text-[10px] hover:brightness-125 transition-all touch-manipulation">Cancelar</button>
            <button type="button" onClick={handleApply} disabled={isProcessing} className="flex-1 py-3 rounded-xl bg-green-500 text-black font-black uppercase text-[10px] flex items-center justify-center gap-1.5 hover:bg-green-400 transition-all disabled:opacity-50 touch-manipulation">
              <Check size={14} /> {isProcessing ? 'Aplicando...' : 'Aplicar Recorte'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
