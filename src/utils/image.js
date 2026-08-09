// Genera una miniatura en base64 a partir de un archivo de imagen. Usa URL.createObjectURL
// en vez de FileReader.readAsDataURL: el navegador puede decodificar la imagen directamente
// desde el blob sin tener que volcar primero el archivo original entero (que en fotos de
// móvil puede pesar varios MB) a una cadena base64 en memoria — evita jank/bloqueos del hilo
// principal en Safari iOS con fotos grandes, ya que solo se codifica el canvas ya reducido.
export const resizeImageToDataUrl = (file, maxSize = 150, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
      return;
    }

    let objectUrl;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (err) {
      reject(err);
      return;
    }

    const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch (err) { /* noop */ } };
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('No se pudo cargar la imagen seleccionada.'));
    };
    img.src = objectUrl;
  });
};
