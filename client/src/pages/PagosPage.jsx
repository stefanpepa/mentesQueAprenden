import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DollarSign, FileText, CheckCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import Modal from '../components/ui/Modal';

const METODO_LABEL = {
  efectivo: 'Efectivo', transferencia: 'Transferencia',
  debito: 'Débito', credito: 'Crédito', obra_social: 'Obra social'
};

export default function PagosPage() {
  const { profesional, isAdmin } = useAuthStore();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [tab, setTab] = useState('pendientes');
  const [modalPagar, setModalPagar] = useState(null);
  const [metodoPago, setMetodoPago] = useState('efectivo');

  const { data: pendientes } = useQuery({
    queryKey: ['sesiones-pendientes'],
    queryFn: () => api.get('/pagos/sesiones-pendientes').then(r => r.data)
  });

  const { data: pagos } = useQuery({
    queryKey: ['pagos', mes],
    queryFn: () => api.get('/pagos', { params: { mes } }).then(r => r.data)
  });

  const { data: liquidacion } = useQuery({
    queryKey: ['liquidacion', mes],
    queryFn: () => api.get('/pagos/liquidacion', { params: { mes } }).then(r => r.data),
    enabled: isAdmin()
  });

  const pagarMutation = useMutation({
    mutationFn: (data) => api.post('/pagos', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sesiones-pendientes'] });
      queryClient.invalidateQueries({ queryKey: ['pagos', mes] });
      queryClient.invalidateQueries({ queryKey: ['liquidacion', mes] });
      setModalPagar(null);
      toast.success('Cobro registrado');
    },
    onError: () => toast.error('Error al registrar el cobro')
  });

  const totalMes = pagos?.reduce((s, p) => s + Number(p.monto_total), 0) || 0;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Pendientes de cobro</p>
          <p className="text-2xl font-bold text-amber-600">{pendientes?.length || 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Facturado en {mes}</p>
          <p className="text-2xl font-bold text-green-600">${totalMes.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Sesiones cobradas</p>
          <p className="text-2xl font-bold text-gray-900">{pagos?.length || 0}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {[
          { id: 'pendientes', label: `Pendientes ${pendientes?.length ? `(${pendientes.length})` : ''}` },
          { id: 'cobrados', label: 'Cobrados' },
          ...(isAdmin() ? [{ id: 'liquidacion', label: 'Liquidación' }] : [])
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pendientes */}
      {tab === 'pendientes' && (
        <div className="space-y-2">
          {!pendientes?.length ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={40} className="mx-auto mb-2 text-gray-200" />
              <p>Sin cobros pendientes</p>
            </div>
          ) : pendientes.map(sesion => (
            <div key={sesion.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {sesion.paciente?.apellido}, {sesion.paciente?.nombre}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {sesion.fecha ? format(new Date(sesion.fecha), "d/MM/yyyy") : ''} · {sesion.tipo}
                </p>
              </div>
              <p className="font-semibold text-gray-900 flex-shrink-0">
                ${Number(sesion.monto).toLocaleString('es-AR')}
              </p>
              <button
                onClick={() => setModalPagar(sesion)}
                className="flex-shrink-0 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-medium"
              >
                Cobrar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Cobrados */}
      {tab === 'cobrados' && (
        <div className="space-y-2">
          {!pagos?.length ? (
            <p className="text-center py-8 text-gray-400">Sin cobros en {mes}</p>
          ) : pagos.map(pago => (
            <div key={pago.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <DollarSign size={18} className="text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {pago.paciente?.apellido}, {pago.paciente?.nombre}
                </p>
                <p className="text-xs text-gray-500">
                  {format(new Date(pago.fecha_pago), "d/MM/yyyy")} · {METODO_LABEL[pago.metodo_pago]}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-gray-900">${Number(pago.monto_total).toLocaleString('es-AR')}</p>
                <p className="text-xs text-gray-400">Prof: ${Number(pago.monto_profesional).toLocaleString('es-AR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liquidación (solo admin) */}
      {tab === 'liquidacion' && liquidacion && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 print:hidden"
            >
              <Printer size={15} /> Imprimir / Guardar PDF
            </button>
          </div>
          <div className="bg-primary-50 rounded-2xl border border-primary-100 p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-600 font-medium">Total espacio — {mes}</p>
              <p className="text-2xl font-bold text-primary-900">${liquidacion.total_espacio?.toLocaleString('es-AR')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-500">Total facturado</p>
              <p className="text-lg font-bold text-primary-700">${liquidacion.total_facturado?.toLocaleString('es-AR')}</p>
            </div>
          </div>

          {liquidacion.profesionales?.map((prof, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{prof.profesional?.apellido}, {prof.profesional?.nombre}</p>
                  <p className="text-xs text-gray-500">{prof.profesional?.especialidad} · {prof.cantidad_sesiones} sesiones</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-gray-50 rounded-xl p-2">
                  <p className="text-xs text-gray-500">Facturado</p>
                  <p className="font-semibold text-sm">${Number(prof.total_facturado).toLocaleString('es-AR')}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-2">
                  <p className="text-xs text-green-600">A pagar</p>
                  <p className="font-semibold text-sm text-green-700">${Number(prof.total_profesional).toLocaleString('es-AR')}</p>
                </div>
                <div className="bg-primary-50 rounded-xl p-2">
                  <p className="text-xs text-primary-600">Espacio</p>
                  <p className="font-semibold text-sm text-primary-700">${Number(prof.total_espacio).toLocaleString('es-AR')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Cobrar */}
      <Modal open={!!modalPagar} onClose={() => setModalPagar(null)} title="Registrar cobro">
        {modalPagar && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-medium">{modalPagar.paciente?.apellido}, {modalPagar.paciente?.nombre}</p>
              <p className="text-gray-500">{modalPagar.tipo} · ${Number(modalPagar.monto).toLocaleString('es-AR')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Método de pago</label>
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Object.entries(METODO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalPagar(null)} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700">Cancelar</button>
              <button
                onClick={() => pagarMutation.mutate({ sesion_id: modalPagar.id, monto_total: modalPagar.monto, metodo_pago: metodoPago })}
                disabled={pagarMutation.isPending}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-medium"
              >
                {pagarMutation.isPending ? 'Registrando...' : `Confirmar $${Number(modalPagar.monto).toLocaleString('es-AR')}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
