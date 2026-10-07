import { useState, useCallback } from 'react';
import { menuImport } from '../services/api';

export function MenuImporter({ comercioId, onComplete }) {
  const [step, setStep] = useState('upload');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState([]);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const validFiles = files.filter(f => 
      ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type) &&
      f.size <= 10 * 1024 * 1024
    );

    if (validFiles.length !== files.length) {
      setError('Algunos archivos no son válidos. Solo JPG, PNG, WebP, PDF (máx 10MB c/u)');
      return;
    }

    const formData = new FormData();
    validFiles.forEach(f => formData.append('menu', f));

    setLoading(true);
    setError(null);

    try {
      const res = await menuImport.upload(formData);
      setPreview(res.preview);
      setEditedProducts(res.preview.productos.map(p => ({ ...p })));
      setStep('preview');
    } catch (err) {
      setError(err.response?.data?.error || 'Error procesando menú');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProductChange = (index, field, value) => {
    setEditedProducts(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: field === 'precio' ? Number(value) || 0 : value } : p
    ));
  };

  const handleConfirm = async () => {
    if (!preview || editedProducts.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      await menuImport.confirm({ comercioId, productos: editedProducts });
      setStep('success');
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Error guardando productos');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('upload');
    setPreview(null);
    setEditedProducts([]);
    setError(null);
  };

  if (step === 'upload') {
    return (
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-500 transition-colors">
        <input
          type="file"
          id="menu-upload"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          multiple
          onChange={handleFileSelect}
          disabled={loading}
          className="hidden"
        />
        <label 
          htmlFor="menu-upload" 
          className="cursor-pointer text-primary-600 hover:underline font-medium"
        >
          Seleccionar menú (PDF, JPG, PNG, WebP - máx 10MB, hasta 5 archivos)
        </label>
        <p className="text-sm text-gray-500 mt-2">
          La IA extraerá: nombre, descripción, precio y categoría de cada producto
        </p>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900">¡Productos importados!</h3>
        <p className="text-gray-500 mt-1">El menú se ha guardado correctamente</p>
        <button 
          onClick={handleRetry}
          className="mt-4 text-primary-600 hover:underline text-sm"
        >
          Importar otro menú
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          Vista previa ({editedProducts.length} productos)
        </h3>
        <span className="text-sm text-gray-500">
          Moneda: {preview?.metadatos?.moneda_detectada || 'COP'}
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

      <p className="text-xs text-gray-400 text-center">
        Confianza IA: {Math.round((preview?.metadatos?.confianza_global || 0) * 100)}% · 
        {preview?.metadatos?.imagenes || 0} imágenes · {preview?.metadatos?.pdfs || 0} PDFs
      </p>
    </div>
  );
}