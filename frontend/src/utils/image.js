// Lee una imagen, la reduce (máx. 480 px) y la devuelve como data URL liviana (WebP si el navegador lo permite, si no JPEG)
export function imageToDataUrl(file, maxSize = 480, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('Selecciona un archivo de imagen')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen no es válida'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const webp = canvas.toDataURL('image/webp', quality);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function resizeToDataUrl(img, maxSize, quality) {
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}

/** Genera la foto completa (720 px, nítida para el catálogo del POS) y la miniatura (160 px) */
export function imageToDataUrls(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) { reject(new Error('Selecciona un archivo de imagen')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen no es válida'));
      img.onload = () => {
        const full = resizeToDataUrl(img, 720, 0.82);
        let thumb = resizeToDataUrl(img, 160, 0.72);
        // La miniatura debe usar el mismo formato que la completa
        if (full.slice(0, 15) !== thumb.slice(0, 15)) thumb = '';
        resolve({ full, thumb });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Reduce una foto ya guardada a miniatura (para optimizar las existentes) */
export function urlToThumb(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    img.onload = () => resolve(resizeToDataUrl(img, 160, 0.72));
    img.src = url;
  });
}
