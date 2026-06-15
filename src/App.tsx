import { useEffect, useState, useRef, useMemo } from 'react';
import { getAlertasActivas, getTodasAlertas, getDetalleAlerta, getSerenosCercanos, getSerenosDisponibles, asignarSereno, setGlobalUserId, actualizarUbicacionAlerta, rechazarAlerta } from './services/api';
import { subscribeToDashboard, subscribeToGlobalEvents } from './services/socket';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ShieldAlert, MapPin, User, Search, Clock, Navigation, CheckCircle, AlertCircle, Menu, Phone, Users, CheckSquare, XCircle, ChevronLeft, LogOut, Edit2, FileText, Bell, Archive, Shield } from 'lucide-react';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Icons using L.divIcon and SVG
const getDivIcon = (bgColor: string, svgContent: string, isPulse: boolean = false, extraClasses: string = '') => L.divIcon({
  html: `
    <div class="relative flex items-center justify-center w-14 h-14 transition-transform hover:scale-110">
      ${isPulse ? `<span class="animate-ping absolute inline-flex h-10 w-10 rounded-full opacity-75" style="background-color: ${bgColor};"></span>` : ''}
      <div class="relative flex items-center justify-center w-10 h-10 rounded-full border-[3px] border-white shadow-[0_4px_10px_rgba(0,0,0,0.4)] text-white ${extraClasses}" style="background-color: ${bgColor};">
        ${svgContent}
      </div>
    </div>
  `,
  className: '',
  iconSize: [56, 56],
  iconAnchor: [28, 28],
  popupAnchor: [0, -28],
});

const userSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const carSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
const bikeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2"/></svg>`;
const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const checkSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

export const getAlertIcon = (estado: string, isDragging: boolean = false) => {
  if (isDragging) return getDivIcon('#f97316', alertSvg, false, 'border-dashed'); // Orange dragging
  
  switch (estado) {
    case 'PENDIENTE': return getDivIcon('#ef4444', alertSvg, true); // red-500
    case 'ASIGNADO': return getDivIcon('#f97316', alertSvg, false); // orange-500
    case 'DESPLIEGUE': return getDivIcon('#a855f7', alertSvg, false); // purple-500
    case 'INTERVENCION': return getDivIcon('#3b82f6', alertSvg, true); // blue-500
    case 'ATENDIDO': return getDivIcon('#22c55e', checkSvg, false); // green-500
    default: return getDivIcon('#94a3b8', alertSvg, false); // slate-400
  }
};

export const getSerenoIcon = (estado: string, tipo: string) => {
  // Serenos disponibles en verde brillante, ocupados en azul índigo
  const bgColor = estado === 'DISPONIBLE' ? '#10b981' : '#4f46e5';
  let svg = userSvg;
  if (tipo === 'AUTO') svg = carSvg;
  else if (tipo === 'MOTO') svg = bikeSvg;
  // Añadimos un pulse leve si están ocupados (en movimiento hacia una alerta)
  return getDivIcon(bgColor, svg, estado !== 'DISPONIBLE');
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center[0], center[1]]);
  return null;
}

// Mock Operators
const OPERADORES_MOCK = [
  { id: 2, nombres: 'Luis', apellidos: 'Paredes', correo: 'operador1@hackathon.pe' },
  { id: 3, nombres: 'Carla', apellidos: 'Díaz', correo: 'operador2@hackathon.pe' }
];

const formatDBDate = (dateString: string) => {
  const d = new Date(dateString);
  // Restamos 12 horas porque la DB está adelantada 12 hrs (ej: si es 14 a las 6pm, la BD guarda 15 a las 6am)
  d.setHours(d.getHours() - 12);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
};

export default function App() {
  const [loggedUser, setLoggedUser] = useState<any | null>(null);
  
  const [alertas, setAlertas] = useState<any[]>([]);
  const [todasAlertas, setTodasAlertas] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'activas' | 'historial'>('activas');
  const [historyFilter, setHistoryFilter] = useState<string>('TODOS');
  const [selectedAlerta, setSelectedAlerta] = useState<any | null>(null);
  const [selectedAlertaDetail, setSelectedAlertaDetail] = useState<any | null>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectCategory, setRejectCategory] = useState('Falsa Alarma');
  const [rejectDetails, setRejectDetails] = useState('');
  
  const [allSerenos, setAllSerenos] = useState<any[]>([]);
  const [serenosParaAsignar, setSerenosParaAsignar] = useState<any[]>([]);
  const [loadingSerenos, setLoadingSerenos] = useState(false);

  // Estado para la ubicación corregida por el operador
  const [draggedLocation, setDraggedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const markerRef = useRef<any>(null);

  const handleLogin = (op: any) => {
    setGlobalUserId(op.id);
    setLoggedUser(op);
  };

  useEffect(() => {
    if (!loggedUser) return;
    loadAlertas();
    loadTodasAlertas();
    loadAllSerenos();

    const unsubDash = subscribeToDashboard((event, data) => {
      // 1. Manejo de estado general y arreglos
      if (event === 'ALERTA_CREADA') {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log('Audio autoplay blocked', e));
        setAlertas(prev => [data, ...prev]);
        loadTodasAlertas();
        setNotifications(prev => [{ id: Date.now(), title: 'Nueva Alerta', message: `Alerta #${data.id} reportada.`, time: new Date() }, ...prev].slice(0, 50));
      } else if (event === 'ALERTA_UBICACION_ACTUALIZADA') {
        setAlertas(prev => prev.map(a => 
          a.id === data.alerta_id ? { ...a, ubicacion_incidencia: data.ubicacion_incidencia } : a
        ));
        if (selectedAlerta?.id === data.alerta_id) {
          setSelectedAlerta((prev: any) => ({ ...prev, ubicacion_incidencia: data.ubicacion_incidencia }));
        }
      } else if (event === 'SERENO_ACTUALIZADO') {
        setAllSerenos(prev => {
          const index = prev.findIndex(s => s.id_usuario === data.id_usuario);
          if (index === -1) return prev;
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        });
      } else {
        const nuevoEstado = data.estado || data.nuevo_estado;
        if (['ATENDIDO', 'RECHAZADO', 'RECHAZADO_MANUAL'].includes(nuevoEstado)) {
          // Si el caso se cierra, lo quitamos de la lista de activas y deseleccionamos
          setAlertas(prev => prev.filter(a => a.id !== data.alerta_id));
          setSelectedAlerta(prev => prev?.id === data.alerta_id ? null : prev);
          loadTodasAlertas(); // Recargamos para que aparezca en el historial
        } else {
          setAlertas(prev => prev.map(a => 
            a.id === data.alerta_id ? { ...a, estado_actual: nuevoEstado } : a
          ));
          setSelectedAlerta(prev => prev?.id === data.alerta_id ? { ...prev, estado_actual: nuevoEstado } : prev);
        }
        setNotifications(prev => [{ id: Date.now(), title: 'Cambio de Estado', message: `Alerta #${data.alerta_id || data.id} pasó a ${nuevoEstado}`, time: new Date() }, ...prev].slice(0, 50));
      }
    });

    const unsubGlobal = subscribeToGlobalEvents((event, data) => {
      if (event === 'SERENO_ACEPTO') {
        setNotifications(prev => [{ id: Date.now(), title: 'Misión Aceptada', message: `Patrulla en camino para alerta #${data.alerta_id}.`, time: new Date() }, ...prev].slice(0, 50));
        setAlertas(prev => prev.map(a => 
          a.id === data.alerta_id ? { ...a, estado_actual: 'DESPLIEGUE' } : a
        ));
        loadAllSerenos();
        alert(`¡Patrulla en camino! El sereno asignado a la alerta #${data.alerta_id} ha aceptado la misión y está en despliegue.`);
      } else if (event === 'SERENO_RECHAZO_TIMEOUT' || event === 'SERENO_RECHAZO_MANUAL') {
        setNotifications(prev => [{ id: Date.now(), title: 'Asignación Rechazada', message: `El sereno rechazó la alerta #${data.alerta_id}.`, time: new Date() }, ...prev].slice(0, 50));
        // Vuelve a PENDIENTE, quitamos "asignado"
        setAlertas(prev => prev.map(a => 
          a.id === data.alerta_id ? { ...a, estado_actual: 'PENDIENTE' } : a
        ));
        if (selectedAlerta?.id === data.alerta_id) {
          setSelectedAlerta((prev: any) => ({ ...prev, estado_actual: 'PENDIENTE' }));
        }
        loadAllSerenos();
        alert(`La asignación para la alerta #${data.alerta_id} fue rechazada o expiró el tiempo.`);
      }
    });

    const intervalId = setInterval(loadAllSerenos, 10000);
    return () => {
      unsubDash();
      unsubGlobal();
      clearInterval(intervalId);
    };
  }, [loggedUser, selectedAlerta]);

  const loadAlertas = async () => {
    try {
      const data = await getAlertasActivas();
      setAlertas(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadTodasAlertas = async () => {
    try {
      const data = await getTodasAlertas();
      setTodasAlertas(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllSerenos = async () => {
    try {
      const data = await getSerenosDisponibles();
      setAllSerenos(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectAlerta = async (alerta: any) => {
    setSelectedAlerta(alerta);
    setDraggedLocation(null);
    setSerenosParaAsignar([]);
    setSelectedAlertaDetail(null);

    // Cargar detalles completos del ciudadano
    try {
      const details = await getDetalleAlerta(alerta.id);
      setSelectedAlertaDetail(details);
    } catch(e) {
      console.error("Error fetching details", e);
    }
    
    // Si la alerta sigue PENDIENTE, calcular serenos
    if (alerta.estado_actual === 'PENDIENTE') {
      calculateSerenos(alerta.ubicacion_incidencia.lat, alerta.ubicacion_incidencia.lng);
    }
  };

  const calculateSerenos = async (lat: number, lng: number) => {
    setLoadingSerenos(true);
    try {
      const serenosCercanos = await getSerenosCercanos(lat, lng);
      if (serenosCercanos.length > 0) {
        const coordsString = serenosCercanos.map(s => `${s.ubicacion_actual.lng},${s.ubicacion_actual.lat}`).join(';');
        const osrmUrl = `https://osrm.tamatacna.com/route/v1/driving/${lng},${lat};${coordsString}?overview=false&sources=0`;
        
        try {
          const osrmRes = await fetch(osrmUrl);
          const osrmData = await osrmRes.json();
          if (osrmData.code === 'Ok' && osrmData.routes) {
            const legs = osrmData.routes[0].legs;
            const updatedSerenos = serenosCercanos.map((s, index) => {
              const leg = legs[index];
              return leg ? {
                ...s,
                distancia_estimada_mts: Math.round(leg.distance),
                tiempo_estimado_llegada_min: Math.max(1, Math.round(leg.duration / 60))
              } : s;
            });
            updatedSerenos.sort((a, b) => a.tiempo_estimado_llegada_min - b.tiempo_estimado_llegada_min);
            setSerenosParaAsignar(updatedSerenos);
          } else {
            setSerenosParaAsignar(serenosCercanos);
          }
        } catch(e) {
          setSerenosParaAsignar(serenosCercanos);
        }
      } else {
        setSerenosParaAsignar([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSerenos(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!selectedAlerta || !draggedLocation) return;
    setIsUpdatingLocation(true);
    try {
      await actualizarUbicacionAlerta(selectedAlerta.id, draggedLocation.lat, draggedLocation.lng);
      const updatedAlerta = { ...selectedAlerta, ubicacion_incidencia: draggedLocation };
      
      setAlertas(prev => prev.map(a => a.id === updatedAlerta.id ? updatedAlerta : a));
      setSelectedAlerta(updatedAlerta);
      setDraggedLocation(null);
      
      // Recalcular rutas desde el nuevo punto
      calculateSerenos(draggedLocation.lat, draggedLocation.lng);
    } catch (e) {
      console.error("Error al actualizar ubicación", e);
      alert("Error al actualizar la ubicación");
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const handleAsignar = async (sereno: any) => {
    if (!selectedAlerta) return;
    try {
      await asignarSereno({
        alerta_id: selectedAlerta.id,
        sereno_id: sereno.id_usuario,
        distancia_estimada_mts: sereno.distancia_estimada_mts,
        tiempo_estimado_llegada_min: sereno.tiempo_estimado_llegada_min
      });
      setAlertas(prev => prev.map(a => 
        a.id === selectedAlerta.id ? { ...a, estado_actual: 'ASIGNADO' } : a
      ));
      setSelectedAlerta({ ...selectedAlerta, estado_actual: 'ASIGNADO' });
      setSerenosParaAsignar([]);
      loadTodasAlertas();
    } catch(e) {
      console.error(e);
      alert('Error al asignar');
    }
  };

  const handleRechazarAlerta = async () => {
    if (!selectedAlerta) return;
    try {
      await rechazarAlerta(selectedAlerta.id, rejectCategory, rejectDetails);
      setAlertas(prev => prev.filter(a => a.id !== selectedAlerta.id));
      setSelectedAlerta(null);
      setIsRejectModalOpen(false);
      setRejectDetails('');
      loadTodasAlertas();
    } catch (e) {
      console.error(e);
      alert('Error al rechazar la alerta');
    }
  };

  // Manejo del drag del marcador
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          setDraggedLocation({ lat: latLng.lat, lng: latLng.lng });
        }
      },
    }),
    [],
  );

  if (!loggedUser) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-2xl w-[400px]">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-blue-600 p-3 rounded-full mb-4 shadow-lg">
              <ShieldAlert size={40} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">AlertasMuniGAl</h1>
            <p className="text-sm text-gray-500">Ingreso Operadores (Hackathon)</p>
          </div>
          <div className="space-y-4">
            {OPERADORES_MOCK.map(op => (
              <button
                key={op.id}
                onClick={() => handleLogin(op)}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-full group-hover:bg-blue-100">
                    <User size={20} className="text-gray-600 group-hover:text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800">{op.nombres} {op.apellidos}</p>
                    <p className="text-xs text-gray-500">{op.correo}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const defaultCenter: [number, number] = [-18.0146, -70.2536];
  const mapCenter: [number, number] = draggedLocation ? [draggedLocation.lat, draggedLocation.lng] : 
    (selectedAlerta ? [selectedAlerta.ubicacion_incidencia.lat, selectedAlerta.ubicacion_incidencia.lng] : defaultCenter);

  const estadoColors: Record<string, string> = {
    'PENDIENTE': 'bg-red-500',
    'ASIGNADO': 'bg-orange-500',
    'DESPLIEGUE': 'bg-purple-500',
    'INTERVENCION': 'bg-blue-500',
    'ATENDIDO': 'bg-green-500'
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-slate-50 font-sans overflow-hidden">
      
      {/* REJECT MODAL */}
      {isRejectModalOpen && selectedAlerta && (
        <div className="absolute inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-[450px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-3">
              <XCircle size={28} className="text-red-500" />
              <div>
                <h3 className="text-lg font-bold text-red-900">Rechazar Alerta #{selectedAlerta.id}</h3>
                <p className="text-xs text-red-600">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Categoría del Rechazo</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  value={rejectCategory}
                  onChange={(e) => setRejectCategory(e.target.value)}
                >
                  <option value="Falsa Alarma">Falsa Alarma</option>
                  <option value="Datos Insuficientes">Datos Insuficientes</option>
                  <option value="Fuera de Jurisdicción">Fuera de Jurisdicción</option>
                  <option value="Prueba">Prueba del Sistema</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Detalles o Motivo (Opcional)</label>
                <textarea 
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-slate-50 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  rows={3}
                  placeholder="Explica brevemente por qué se rechaza esta alerta..."
                  value={rejectDetails}
                  onChange={(e) => setRejectDetails(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button 
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleRechazarAlerta}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <XCircle size={16} /> Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <div className="w-full md:w-[400px] lg:w-[450px] h-1/2 md:h-full bg-white shadow-[10px_0_15px_-3px_rgba(0,0,0,0.1)] z-10 flex flex-col flex-shrink-0">
        <div className="p-6 bg-slate-900 text-white flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <ShieldAlert size={28} className="text-blue-400" />
            <div>
              <h1 className="text-xl font-bold tracking-wide">AlertasMuniGAl</h1>
              <p className="text-xs text-slate-400 font-mono">DASHBOARD TÁCTICO</p>
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-800 p-2 rounded-lg text-sm relative">
            <div className="flex items-center gap-2">
              <User size={16} className="text-slate-400" />
              <span>Op: <span className="font-semibold text-blue-300">{loggedUser.nombres}</span></span>
            </div>
            
            <div className="flex items-center gap-3">
              <button onClick={() => setShowNotifications(!showNotifications)} className="relative text-slate-300 hover:text-white transition-colors">
                <Bell size={20} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {selectedAlerta && (
                <button onClick={() => setSelectedAlerta(null)} className="text-xs flex items-center bg-slate-700 px-2 py-1 rounded hover:bg-slate-600 transition-colors">
                  <ChevronLeft size={14}/> Volver
                </button>
              )}
            </div>

            {/* Panel de Notificaciones */}
            {showNotifications && (
              <div className="absolute top-12 right-0 w-80 bg-white shadow-2xl rounded-xl z-50 border border-slate-200 overflow-hidden flex flex-col max-h-96">
                <div className="bg-slate-100 p-3 border-b text-slate-700 font-bold text-sm">Registro de Actividad</div>
                <div className="flex-1 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="text-center text-slate-400 text-xs py-4">No hay actividad reciente</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                        <p className="text-xs font-bold text-slate-800">{n.title}</p>
                        <p className="text-[11px] text-slate-600">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{n.time.toLocaleTimeString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* VISTA DETALLE DE ALERTA O LISTA */}
        {selectedAlerta ? (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <div className="flex justify-between items-start mb-6 border-b pb-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Alerta #{selectedAlerta.id}</h2>
                <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full text-white ${estadoColors[selectedAlerta.estado_actual] || 'bg-gray-500'}`}>
                  ESTADO: {selectedAlerta.estado_actual}
                </span>
              </div>
              {selectedAlerta.estado_actual === 'PENDIENTE' && (
                <button 
                  onClick={() => setIsRejectModalOpen(true)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <XCircle size={14} /> Rechazar
                </button>
              )}
            </div>

            {selectedAlertaDetail ? (
              <div className="space-y-6">
                {/* Datos del Ciudadano */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                    <User size={16} className="text-blue-500"/> Datos del Solicitante
                  </h3>
                  <p className="text-lg font-bold text-slate-900">{selectedAlertaDetail.ciudadano_contacto.nombre_completo}</p>
                  <p className="text-slate-600 flex items-center gap-2 mt-1">
                    <Phone size={14}/> {selectedAlertaDetail.ciudadano_contacto.celular || 'No registrado'}
                  </p>
                </div>

                {/* Contactos Familiares */}
                {selectedAlertaDetail.ciudadano_contacto.contactos_referencia?.length > 0 && (
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                      <Users size={16} className="text-orange-500"/> Contactos de Emergencia
                    </h3>
                    <div className="space-y-2">
                      {selectedAlertaDetail.ciudadano_contacto.contactos_referencia.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between text-sm bg-slate-50 p-2 rounded-lg">
                          <span className="font-semibold text-slate-800">{c.nombre_referencia} ({c.tipo_relacion})</span>
                          <span className="text-slate-600 flex items-center gap-1"><Phone size={12}/>{c.celular}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info Incidencia */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                  <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-500"/> Detalle de Incidencia
                  </h3>
                  <p className="text-slate-700 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                    {selectedAlertaDetail.descripcion || 'Sin descripción.'}
                  </p>
                </div>

                {/* Patrulla Asignada */}
                {selectedAlertaDetail.sereno_asignado && (
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                      <Shield size={16} className="text-indigo-500"/> Unidad Asignada
                    </h3>
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-slate-900">{selectedAlertaDetail.sereno_asignado.nombre_completo}</p>
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded uppercase">
                          {selectedAlertaDetail.sereno_asignado.tipo_unidad || 'UNIDAD'}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm flex items-center gap-2 mb-2">
                        <Phone size={14}/> {selectedAlertaDetail.sereno_asignado.celular || 'No registrado'}
                      </p>
                      <div className="flex justify-between text-xs font-bold border-t border-indigo-100 pt-2 mt-1">
                        <span className="text-slate-500">Estado: <span className="text-indigo-600">{selectedAlertaDetail.sereno_asignado.estado_asignacion}</span></span>
                        <span className="text-slate-500">ETA orig.: <span className="text-indigo-600">{selectedAlertaDetail.sereno_asignado.eta} min</span></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Informe Finalización */}
                {selectedAlertaDetail.formulario_ciudadano && (
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                      <FileText size={16} className="text-green-500"/> {selectedAlertaDetail.formulario_ciudadano.titulo || 'Informe del Sereno'}
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(selectedAlertaDetail.formulario_ciudadano.respuestas || {}).map(([key, val]) => (
                        <div key={key} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{key}</p>
                          <p className="text-sm text-slate-800 font-medium">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-pulse flex flex-col gap-4">
                <div className="h-24 bg-slate-200 rounded-xl"></div>
                <div className="h-32 bg-slate-200 rounded-xl"></div>
              </div>
            )}
            
            {/* Aviso Drag & Drop */}
            {selectedAlerta.estado_actual === 'PENDIENTE' && (
              <div className="mt-6 bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 text-sm">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Edit2 size={16}/> Corregir Ubicación
                </div>
                <p>Puedes <strong>arrastrar el marcador rojo en el mapa</strong> para afinar el "Lugar de los Hechos" real tras confirmar por teléfono.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 flex flex-col">
            <div className="flex bg-slate-200 p-1 rounded-lg mb-2">
              <button 
                onClick={() => setActiveTab('activas')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'activas' ? 'bg-white shadow text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Activas
              </button>
              <button 
                onClick={() => { setActiveTab('historial'); loadTodasAlertas(); }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'historial' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Historial
              </button>
            </div>

            <div className="flex justify-between items-center mb-2 px-1">
              <h2 className="font-bold text-slate-700 uppercase tracking-wider text-sm">
                {activeTab === 'activas' ? 'Bandeja de Entrada' : 'Historial General'}
              </h2>
              <span className={`${activeTab === 'activas' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'} font-bold px-2 py-1 rounded-md text-xs`}>
                {activeTab === 'activas' ? alertas.length : todasAlertas.filter(a => historyFilter === 'TODOS' || a.estado_actual === historyFilter).length}
              </span>
            </div>

            {activeTab === 'historial' && (
              <div className="flex flex-wrap gap-2 mb-4 p-2 bg-slate-100 rounded-xl border border-slate-200">
                {['TODOS', 'ATENDIDO', 'RECHAZADO', 'PENDIENTE', 'ASIGNADO', 'DESPLIEGUE'].map(estado => (
                  <button 
                    key={estado}
                    onClick={() => setHistoryFilter(estado)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${historyFilter === estado ? 'bg-blue-600 text-white shadow-blue-500/30' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                  >
                    {estado}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'activas' ? (
              alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
                  <CheckCircle size={40} className="mb-2 opacity-50" />
                  <p>No hay alertas activas</p>
                </div>
              ) : (
                alertas.map(a => (
                  <div 
                    key={a.id} 
                    onClick={() => handleSelectAlerta(a)}
                    className="p-5 rounded-2xl border-2 cursor-pointer border-transparent bg-white shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full text-white ${estadoColors[a.estado_actual] || 'bg-gray-500'}`}>
                        {a.estado_actual}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {formatDBDate(a.created_at)}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">Caso #{a.id}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {a.descripcion || 'Sin descripción detallada.'}
                    </p>
                  </div>
                ))
              )
            ) : (
              todasAlertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-slate-400">
                  <Archive size={40} className="mb-2 opacity-50" />
                  <p>No hay historial de alertas</p>
                </div>
              ) : (
                todasAlertas.filter(a => historyFilter === 'TODOS' || a.estado_actual === historyFilter).map(a => (
                  <div 
                    key={a.id} 
                    onClick={() => handleSelectAlerta(a)}
                    className="p-4 rounded-xl border border-slate-200 cursor-pointer bg-white hover:border-slate-400 transition-all mb-3"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${estadoColors[a.estado_actual] || 'bg-gray-500'}`}>
                        {a.estado_actual}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDBDate(a.created_at)}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-700 text-sm">Caso #{a.id}</h3>
                    <p className="text-xs text-slate-500 truncate mt-1">
                      {a.descripcion || 'Sin descripción.'}
                    </p>
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>

      {/* MAIN - Mapa y Detalles */}
      <div className="flex-1 relative flex flex-col">
        {/* Confirmar Cambio Ubicación Button */}
        {draggedLocation && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] bg-white p-3 rounded-full shadow-2xl flex items-center gap-4 border-2 border-orange-400 animate-bounce">
            <span className="font-bold text-slate-800 text-sm">¿Confirmar nuevo Lugar de los Hechos?</span>
            <button 
              onClick={handleUpdateLocation}
              disabled={isUpdatingLocation}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-md"
            >
              {isUpdatingLocation ? 'Actualizando...' : 'Confirmar'}
            </button>
          </div>
        )}

        {/* MAPA */}
        <div className="flex-1 relative">
          <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; Tamatacna / MuniGal'
              url="https://mapa.tamatacna.com/styles/basic-preview/{z}/{x}/{y}.png"
            />
            <MapUpdater center={mapCenter} />
            
            {/* Serenos Globales */}
            {allSerenos.map(s => (
              <Marker key={`global-${s.id_usuario}`} position={[s.ubicacion_actual.lat, s.ubicacion_actual.lng]} icon={getSerenoIcon(s.estado_disponibilidad, s.tipo)}>
                <Popup>
                  <strong className="text-green-700">Patrulla Disponible</strong> <span className="text-xs font-bold text-slate-500">[{s.tipo || 'UNIDAD'}]</span><br/>
                  {s.nombres} {s.apellidos}
                </Popup>
              </Marker>
            ))}

            {/* Todas las Alertas Activas */}
            <MarkerClusterGroup chunkedLoading>
              {alertas.map(a => {
              const isSelected = selectedAlerta?.id === a.id;
              const isPending = a.estado_actual === 'PENDIENTE';
              const isDragging = isSelected && !!draggedLocation;
              const position = isDragging
                ? [draggedLocation.lat, draggedLocation.lng] as [number, number]
                : [a.ubicacion_incidencia.lat, a.ubicacion_incidencia.lng] as [number, number];

              const icon = getAlertIcon(a.estado_actual, isDragging);
              
              return (
                <Marker 
                  key={`alerta-${a.id}`}
                  draggable={isSelected && isPending}
                  eventHandlers={
                    (isSelected && isPending) 
                      ? eventHandlers 
                      : { click: () => handleSelectAlerta(a) }
                  }
                  position={position} 
                  icon={icon}
                  ref={isSelected ? markerRef : undefined}
                >
                  <Popup className="font-sans">
                    <h3 className="font-bold text-red-600">Alerta #{a.id}</h3>
                    <p>{a.descripcion}</p>
                    <p className="font-semibold text-sm">Estado: {a.estado_actual}</p>
                    {isSelected && isPending && <span className="text-xs text-slate-500 italic">Arrastra para mover</span>}
                    {!isSelected && <span className="text-xs text-blue-500 underline cursor-pointer">Click para atender</span>}
                  </Popup>
                </Marker>
              );
            })}
            </MarkerClusterGroup>

            {/* Serenos Filtrados (Asignación) */}
            {selectedAlerta?.estado_actual === 'PENDIENTE' && !draggedLocation && serenosParaAsignar.map(s => (
              <Marker key={`asignar-${s.id_usuario}`} position={[s.ubicacion_actual.lat, s.ubicacion_actual.lng]} icon={getSerenoIcon('OCUPADO', s.tipo)}>
                <Popup>
                  <strong>{s.nombres} {s.apellidos}</strong> <span className="text-xs text-blue-500 font-bold">[{s.tipo || 'UNIDAD'}]</span><br/>
                  Llega en: {s.tiempo_estimado_llegada_min} min<br/>
                  A {s.distancia_estimada_mts} mts
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* PANEL INFERIOR - Asignación MÁS PEQUEÑO Y COMPACTO */}
        {selectedAlerta && selectedAlerta.estado_actual === 'PENDIENTE' && !draggedLocation && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-3xl bg-white/95 backdrop-blur-md shadow-2xl z-[1000] p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2 border-b pb-2">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Navigation size={18} className="text-blue-600" /> 
                Patrullas Cercanas (OSRM)
              </h3>
              <div className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[11px] font-bold">
                {serenosParaAsignar.length} Disponibles
              </div>
            </div>
            
            <div className="mb-3 flex flex-wrap gap-2 text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span className="font-bold text-slate-600">Velocidades est. de cálculo:</span>
              <span>🏍️ Moto: 40 km/h</span>
              <span>🚓 Auto: 30 km/h</span>
              <span>🚶 Infantería: 10 km/h</span>
            </div>
            
            {loadingSerenos ? (
              <div className="flex items-center justify-center p-4 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                <p className="font-bold text-sm">Calculando rutas exactas...</p>
              </div>
            ) : serenosParaAsignar.length === 0 ? (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-center text-sm">
                <p className="font-bold">⚠️ No hay patrullas cerca</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[30vh] overflow-y-auto pr-1">
                {serenosParaAsignar.map((s, index) => (
                  <div key={s.id_usuario} className="bg-white border border-slate-200 p-3 rounded-xl hover:border-blue-400 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-max mb-1 uppercase">{s.tipo || 'UNIDAD'}</span>
                        <p className="font-bold text-slate-800 text-sm leading-tight">{s.nombres} {s.apellidos}</p>
                      </div>
                      {index === 0 && <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1 py-0.5 rounded">Rápido</span>}
                    </div>
                    <div className="flex gap-3 mb-3">
                      <div className="flex items-center gap-1 text-slate-700">
                        <Clock size={14} className="text-blue-500" />
                        <span className="font-bold text-sm">{s.tiempo_estimado_llegada_min}m</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 text-xs">
                        <MapPin size={12} />
                        <span>{s.distancia_estimada_mts}mts</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleAsignar(s)}
                      className="w-full bg-slate-900 hover:bg-blue-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex justify-center items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle size={14} /> Asignar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

