import { useState } from 'react';

/**
 * Stub de extracción de datos por OCR/IA. Deja la interfaz lista para conectar
 * Tesseract.js (en el navegador) o una API de visión (Claude/GPT) más adelante:
 * `run(imageDataUrl)` debería resolver `data` con los campos reconocidos
 * (name, rating, age, positions, marketValue...) para precargar PlayerForm.
 */
export function useOcrExtraction() {
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);

  const run = async () => {
    setStatus('processing');
    setData(null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setStatus('unavailable');
  };

  const reset = () => { setStatus('idle'); setData(null); };

  return { status, data, run, reset };
}
