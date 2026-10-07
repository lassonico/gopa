import { useState, useRef, useEffect } from 'react';
import { uploads } from '../services/api';

const EMOJIS = [
  '🍔', '🍕', '🍟', '🌮', '🌭', '🥗', '🍣', '🍜', '🥘', '🍛',
  '🍝', '🥪', '🌯', '🥙', '🍲', '🥣', '🥧', '🍰', '🧁', '🍩',
  '🍪', '🍦', '🍨', '🍧', '🍮', '🥤', '☕', '🍵', '🍷', '🍺',
  '🥤', '🥤', '🥤', '🥤', '🥤', '🥤', '🥤', '🥤', '🥤', '🥤'
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getEmojiForProduct(nombre) {
  return EMOJIS[hashString(nombre) % EMOJIS.length];
}

export default function ProductCropper({ 
  imageSrc, 
  products, 
  onProductsChange,
  onUploadProgress 
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [croppedImages, setCroppedImages] = useState({});
  const [uploading, setUploading] = useState({});
  const [imageLoaded, setImageLoaded] = useState(false);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const cropRef = useRef({ x: 0, y: 0, size: 200 });
  const isDragging = useRef(false);
  const dragType = useRef(null);

  const currentProduct = products[currentIndex];
  const hasCrop = croppedImages[currentProduct?.id];

  useEffect(() => {
    if (imageSrc && imgRef.current) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = imageSrc;
    }
  }, [imageSrc]);

  useEffect(() => {
    if (currentProduct && imgRef.current && imgRef.current.width) {
      const img = imgRef.current;
      const scale = Math.min(img.naturalWidth, img.naturalHeight);
      const initialSize = Math.min(scale * 0.3, 200);
      cropRef.current = {
        x: (img.naturalWidth - initialSize) / 2,
        y: (img.naturalHeight - initialSize) / 2,
        size: initialSize
      };
    }
  }, [currentIndex, currentProduct, imageSrc]);

  const generateCroppedBase64 = () => {
    if (!imgRef.current || !canvasRef.current) return null;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y, size } = cropRef.current;
    
    canvas.width = 80;
    canvas.height = 80;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(
      imgRef.current,
      x, y, size, size,
      0, 0, 80, 80
    );
    
    return canvas.toDataURL('image/jpeg', 0.7);
  };

  const handleSaveCrop = async () => {
    if (!currentProduct) return;
    
    const base64 = generateCroppedBase64();
    if (!base64) return;

    setUploading(prev => ({ ...prev, [currentProduct.id]: true }));
    
    try {
      const { data } = await uploads.uploadBase64({ file: base64 });
      setCroppedImages(prev => ({
        ...prev,
        [currentProduct.id]: { url: data.url, publicId: data.publicId }
      }));
      if (onUploadProgress) onUploadProgress(currentProduct.id, data.url);
    } catch (err) {
      console.error('Error subiendo recorte:', err);
    } finally {
      setUploading(prev => ({ ...prev, [currentProduct.id]: false }));
    }
  };

  const handleNext = () => {
    if (currentIndex < products.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const getEmojiFallback = (product) => {
    const emoji = getEmojiForProduct(product.nombre);
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, 80, 80);
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 40, 44);
    return canvas.toDataURL('image/jpeg', 0.7);
  };

  const handleUseEmoji = async () => {
    if (!currentProduct) return;
    
    const base64 = getEmojiFallback(currentProduct);
    setCroppedImages(prev => ({
      ...prev,
      [currentProduct.id]: { url: base64, isEmoji: true }
    }));
    handleNext();
  };

  const handleMouseDown = (e) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const { x, y, size } = cropRef.current;
    const displayWidth = imgRef.current.width;
    const displayHeight = imgRef.current.height;
    const scaleX = imgRef.current.naturalWidth / displayWidth;
    const scaleY = imgRef.current.naturalHeight / displayHeight;
    
    const cropX = x / scaleX;
    const cropY = y / scaleY;
    const cropSize = size / scaleX;
    
    const handleX = cropX + cropSize - 10;
    const handleY = cropY + cropSize - 10;
    
    if (mouseX >= handleX && mouseX <= handleX + 20 && mouseY >= handleY && mouseY <= handleY + 20) {
      isDragging.current = true;
      dragType.current = 'resize';
    } else if (mouseX >= cropX && mouseX <= cropX + cropSize && mouseY >= cropY && mouseY <= cropY + cropSize) {
      isDragging.current = true;
      dragType.current = 'move';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current || !imgRef.current) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const displayWidth = imgRef.current.width;
    const displayHeight = imgRef.current.height;
    const scaleX = imgRef.current.naturalWidth / displayWidth;
    const scaleY = imgRef.current.naturalHeight / displayHeight;
    
    if (dragType.current === 'move') {
      cropRef.current.x = Math.max(0, Math.min(
        imgRef.current.naturalWidth - cropRef.current.size,
        (mouseX - cropRef.current.size / 2 / scaleX) * scaleX
      ));
      cropRef.current.y = Math.max(0, Math.min(
        imgRef.current.naturalHeight - cropRef.current.size,
        (mouseY - cropRef.current.size / 2 / scaleY) * scaleY
      ));
    } else if (dragType.current === 'resize') {
      const newSizeX = (mouseX - cropRef.current.x / scaleX) * scaleX;
      const newSizeY = (mouseY - cropRef.current.y / scaleY) * scaleY;
      const newSize = Math.min(
        Math.max(20, Math.min(newSizeX, newSizeY)),
        Math.min(imgRef.current.naturalWidth - cropRef.current.x, imgRef.current.naturalHeight - cropRef.current.y)
      );
      cropRef.current.size = newSize;
    }
    
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, 80, 80);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragType.current = null;
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const drawCanvas = () => {
    if (!canvasRef.current || !imgRef.current || !imageLoaded) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    const { x, y, size } = cropRef.current;
    
    const displayWidth = img.width;
    const displayHeight = img.height;
    const scaleX = img.naturalWidth / displayWidth;
    const scaleY = img.naturalHeight / displayHeight;
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
    
    ctx.strokeStyle = '#5E244E';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x / scaleX, y / scaleY, size / scaleX, size / scaleY);
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#5E244E';
    ctx.fillRect(
      (x + size) / scaleX - 10,
      (y + size) / scaleY - 10,
      20, 20
    );
  };

  useEffect(() => {
    drawCanvas();
  }, [cropRef.current.x, cropRef.current.y, cropRef.current.size, imageLoaded, currentIndex]);

  if (!imageSrc || products.length === 0) return null;

  const product = currentProduct;
  const progress = uploading[product.id] ? 'Subiendo...' : hasCrop ? '✓ Subida' : 'Pendiente';

  return (
    <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#5E244E' }}>
          Recortar: {product.nombre || 'Producto ' + (currentIndex + 1)}
        </h3>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          {currentIndex + 1} / {products.length}
        </span>
      </div>

      <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Carta"
          style={{ width: '100%', height: 'auto', maxHeight: 400, display: 'block' }}
          onLoad={() => setImageLoaded(true)}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          onMouseDown={handleMouseDown}
        />
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          ← Anterior
        </button>
        
        <button
          onClick={handleSaveCrop}
          disabled={uploading[product.id] || hasCrop}
          className={hasCrop ? 'btn' : 'btn btn-primary'}
          style={{ padding: '8px 16px', fontSize: 13 }}
        >
          {uploading[product.id] ? '⏳' : hasCrop ? '✓ Guardado' : '💾 Guardar recorte'}
        </button>

        <button
          onClick={handleUseEmoji}
          className="btn"
          style={{ padding: '8px 16px', fontSize: 13, background: '#f3f4f6', color: '#374151' }}
        >
          😀 Usar emoji
        </button>

        <button
          onClick={handleSkip}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: 13, marginLeft: 'auto' }}
        >
          Saltar →
        </button>
      </div>

      <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
        Arrastra el cuadro morado. Esquina ↘ para redimensionar. 
        {hasCrop && ' ✅ Imagen guardada en Cloudinary'}
        {!hasCrop && !uploading[product.id] && ' ⚠️ Sin imagen - se usará emoji al saltar'}
      </p>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {products.map((p, idx) => (
          <div
            key={p.id}
            style={{
              width: 50, height: 50, borderRadius: 8, border: '2px solid',
              borderColor: idx === currentIndex ? '#5E244E' : '#e5e7eb',
              overflow: 'hidden', background: '#f3f4f6', cursor: 'pointer',
              opacity: croppedImages[p.id] || uploading[p.id] ? 1 : 0.5
            }}
            onClick={() => setCurrentIndex(idx)}
            title={p.nombre}
          >
            {croppedImages[p.id]?.url ? (
              <img src={croppedImages[p.id].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {getEmojiForProduct(p.nombre)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}