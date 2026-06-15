import axios from 'axios';

let currentUserId = 2; // Default fallback

export const setGlobalUserId = (id: number) => {
  currentUserId = id;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  }
});

api.interceptors.request.use((config) => {
  if (config.method === 'post' || config.method === 'patch') {
    config.data = {
      ...config.data,
      usuario_id: currentUserId
    };
  } else if (config.method === 'get') {
    config.params = {
      ...config.params,
      usuario_id: currentUserId
    };
  }
  return config;
});

export const getAlertasActivas = async () => {
  const response = await api.get('/alertas/activas');
  return response.data;
};

export const getDetalleAlerta = async (id: number) => {
  const response = await api.get(`/alertas/${id}/detalle-operador`);
  return response.data;
};

export const getSerenosDisponibles = async () => {
  const response = await api.get('/serenos/disponibles');
  return response.data;
};

export const getSerenosCercanos = async (lat: number, lng: number) => {
  const response = await api.get(`/serenos/cercanos`, {
    params: { lat, lng, limit: 100 }
  });
  return response.data;
};

export const getTodasAlertas = async () => {
  const response = await api.get('/alertas/todas');
  return response.data.data;
};

export const getHistorialAlerta = async (id: number) => {
  const response = await api.get(`/alertas/${id}/historial`);
  return response.data.data;
};

export const asignarSereno = async (data: {

  alerta_id: number;
  sereno_id: number;
  distancia_estimada_mts: number;
  tiempo_estimado_llegada_min: number;
}) => {
  const response = await api.post('/asignaciones', data);
  return response.data;
};

export const rechazarAlerta = async (id: number, categoria: string, motivo: string) => {
  const response = await api.post(`/alertas/${id}/rechazar`, {
    categoria_rechazo: categoria,
    motivo_detalle: motivo
  });
  return response.data;
};

export const actualizarUbicacionAlerta = async (id: number, lat: number, lng: number) => {
  const response = await api.patch(`/alertas/${id}/ubicacion`, { lat, lng });
  return response.data;
};

export default api;

