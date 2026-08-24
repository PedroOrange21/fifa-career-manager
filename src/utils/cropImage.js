// Exporta el área recortada (croppedAreaPixels, tal como la reporta react-easy-crop) de
// "imageSrc" como Data URL cuadrado ya listo para guardar — usado por ImageCropperModal.
const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('No se pudo cargar la imagen para recortarla.'));
  img.src = src;
});

export async function getCroppedImageDataUrl(imageSrc, croppedAreaPixels, { outputSize = 320, quality = 0.85 } = {}) {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    image,
    croppedAreaPixels.x, croppedAreaPixels.y, croppedAreaPixels.width, croppedAreaPixels.height,
    0, 0, outputSize, outputSize,
  );
  return canvas.toDataURL('image/jpeg', quality);
}

// Lee un File tal cual, sin redimensionar — el recorte interactivo necesita la imagen a su
// resolución original para poder hacer zoom con calidad, a diferencia de resizeImageToDataUrl
// (que ya reduce a un tamaño fijo pensado para el resultado final, no para editarlo).
export const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(file);
});
