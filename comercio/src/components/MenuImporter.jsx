import { useState } from 'react';
import { useApi } from '../hooks/useApi';

export function MenuImporter({ comercioId, onComplete }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [editedProducts, setEditedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { post } = useApi();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Solo se permiten PDF, JPG, PNG o WebP');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Archivo demasiado grande (máx 10MB)');
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('menu', file);

    try {
      const res = await post('/comercios/menu/import', formData);
      setPreview(res.preview);
      setEditedProducts(res.preview.productos.map(p => ({ ...p })));
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Error procesando menú');
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index, field, value) => {
    setEditedProducts(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleConfirm = async () => {
    if (editedProducts.length === 0) return;
    setLoading(true);
    setError(null);
    
    try {
      await post('/comercios/menu/confirm', {
        comercioId,
        productos: editedProducts
      });
      onComplete?.();
      setStep('success');
    } catch (err) {
      setError(err.message || 'Error guardando productos');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setEditedProducts([]);
    setError(null);
  };

  if (step === 'success') {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">¡Productos importados!</h3>
        <p className="text-gray-500 mb-6">El menú se ha guardado correctamente</p>
        <button 
          onClick={handleRetry}
          className="text-primary-600 hover:underline font-medium"
        >
          Importar otro menú
        </button>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Vista previa ({editedProducts.length} productos)
          </h3>
          <span className="text-sm text-gray-500">
            {preview?.metadatos?.moneda_detectada || 'COP'} · 
            {Math.round((preview?.metadatos?.confianza_global || 0) * 100)}% confianza
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
          <div className="px-4 py-2 bg-gray-50 font-semibold text-xs text-gray-600 grid grid-cols-12 gap-2">
            <span className="col-span-5">Producto</span>
            <span className="col-span-4">Descripción</span>
            <span className="col-span-2">Precio</span>
            <span className="col-span-1">Cat.</span>
          </div>
          
          {editedProducts.map((producto, index) => (
            <div key={index} className="px-4 py-3 hover:bg-gray-50 grid grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={producto.nombre}
                onChange={(e) => handleProductChange(index, 'nombre', e.target.value)}
                className="col-span-5 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                maxLength={100}
              />
              <input
                type="text"
                value={producto.descripcion}
                onChange={(e) => handleProductChange(index, 'descripcion', e.target.value)}
                className="col-span-4 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                maxLength={300}
                placeholder="Opcional"
              />
              <input
                type="number"
                step="100"
                min="1"
                value={producto.precio}
                onChange={(e) => handleProductChange(index, 'precio', e.target.value)}
                className="col-span-2 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <select
                value={producto.categoria}
                onChange={(e) => handleProductChange(index, 'categoria', e.target.value)}
                className="col-span-1 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="entradas">Entradas</option>
                <option value="platos fuertes">Platos fuertes</option>
                <option value="acompañamientos">Acompañamientos</option>
                <option value="bebidas">Bebidas</option>
                <option value="postres">Postres</option>
                <option value="combos">Combos</option>
                <option value="especiales">Especiales</option>
                <option value="otras">Otras</option>
              </select>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setStep('upload')}
            disabled={loading}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Volver
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || editedProducts.length === 0}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Guardando...' : `Confirmar e importar ${editedProducts.length} productos`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
      <input 
        type="file" 
        accept=".pdf,.jpg,.jpeg,.png,.webp" 
        onChange={handleFileChange} 
        hidden 
        id="menu-upload" 
        disabled={loading} 
      />
      <label 
        htmlFor="menu-upload" 
        className="cursor-pointer text-primary-600 hover:underline font-medium text-lg"
      >
        Seleccionar menú (PDF, JPG, PNG, WebP - máx 10MB)
      </label>
      <p className="text-sm text-gray-500 mt-2">
        La IA extraerá nombre, descripción, precio y categoría de cada producto
      </p>
      
      {file && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
          <p className="font-medium text-sm text-gray-900">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {file && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="mt-6 px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Procesando con IA...' : 'Analizar menú con IA'}
        </button>
      )}
    </div>
  );
}