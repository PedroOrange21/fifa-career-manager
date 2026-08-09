import { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { resizeImageToDataUrl } from '../../utils/image';

export default function UploadDropzone({ image, onImageChange }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);

  const loadFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setIsLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1200, 0.85);
      onImageChange(dataUrl);
    } finally {
      setIsLoading(false);
    }
  };

  if (image) {
    return (
      <div className="relative rounded-[24px] overflow-hidden border border-border-subtle shadow-2xl">
        <img src={image} alt="Captura subida" className="w-full max-h-[420px] object-contain bg-well" />
        <button onClick={() => onImageChange(null)} className="absolute top-3 right-3 p-2 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors"><X size={16} /></button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); loadFile(e.dataTransfer.files[0]); }}
      className={`rounded-[24px] border-2 border-dashed p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${isDragging ? 'border-green-500 bg-green-500/5' : 'border-border hover:border-fg-muted bg-surface'}`}
    >
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => loadFile(e.target.files[0])} />
      {isLoading ? (
        <span className="text-[10px] font-black uppercase tracking-widest text-fg-muted">Procesando imagen...</span>
      ) : (
        <>
          <div className="flex gap-2 text-fg-faint"><Camera size={28} /><ImagePlus size={28} /></div>
          <span className="text-xs font-black uppercase tracking-widest text-fg-secondary">Toca para subir una captura</span>
          <span className="text-[10px] text-fg-faint font-bold">o arrástrala aquí</span>
        </>
      )}
    </div>
  );
}
