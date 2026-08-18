import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, ChevronRight, User } from 'lucide-react';
import api from '../services/api';
import { format, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_BADGE = {
  activo: 'bg-green-100 text-green-700',
  derivado: 'bg-amber-100 text-amber-700',
  alta: 'bg-blue-100 text-blue-700',
  inactivo: 'bg-gray-100 text-gray-600'
};

const ESTADO_LABEL = {
  activo: 'Activo',
  derivado: 'Derivado',
  alta: 'Alta',
  inactivo: 'Inactivo'
};

function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function PacientesPage() {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [page, setPage] = useState(1);
  const debouncedBusqueda = useDebounce(busqueda);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pacientes', debouncedBusqueda, estadoFiltro, page],
    queryFn: () => api.get('/pacientes', {
      params: { busqueda: debouncedBusqueda || undefined, estado: estadoFiltro || undefined, page, limit: 20 }
    }).then(r => r.data),
    keepPreviousData: true
  });

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
        <Link
          to="/pacientes/nuevo"
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Nuevo paciente</span>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, apellido o DNI..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          />
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value); setPage(1); }}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="derivado">Derivados</option>
          <option value="alta">Alta</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          Error al cargar pacientes
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data?.data?.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <User size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No se encontraron pacientes</p>
                {busqueda && <p className="text-sm mt-1">Intentá con otro nombre o DNI</p>}
              </div>
            ) : data?.data?.map((paciente) => (
              <Link
                key={paciente.id}
                to={`/pacientes/${paciente.id}`}
                className="flex items-center gap-4 bg-white rounded-xl p-4 hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-semibold text-sm">
                    {paciente.nombre[0]}{paciente.apellido[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">
                      {paciente.apellido}, {paciente.nombre}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[paciente.estado]}`}>
                      {ESTADO_LABEL[paciente.estado]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-3 flex-wrap mt-0.5">
                    <span>DNI {paciente.dni}</span>
                    <span>·</span>
                    <span>{differenceInYears(new Date(), new Date(paciente.fecha_nacimiento))} años</span>
                    {paciente.profesional_principal && (
                      <>
                        <span>·</span>
                        <span>{paciente.profesional_principal.apellido}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>

          {/* Paginación */}
          {data?.pagination && data.pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                {data.pagination.total} pacientes · Página {page} de {data.pagination.pages}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
