import Pusher from 'pusher-js';

// Soketi connection
export const pusher = new Pusher('pxZkkTUkx5UQ4cEmvDRgcZ5nwbpQY535', {
  wsHost: 'soketi.tamatacna.com',
  wsPort: 80,
  wssPort: 443,
  forceTLS: true,
  disableStats: true,
  enabledTransports: ['ws', 'wss'],
  cluster: '' // No se usa en Soketi pero pusher-js lo pide a veces
});

export const subscribeToDashboard = (callback: (event: string, data: any) => void) => {
  const channel = pusher.subscribe('dashboard-operador');
  
  channel.bind('ALERTA_CREADA', (data: any) => callback('ALERTA_CREADA', data));
  channel.bind('ALERTA_INTERVENCION', (data: any) => callback('ALERTA_INTERVENCION', data));
  channel.bind('ALERTA_ATENDIDA', (data: any) => callback('ALERTA_ATENDIDA', data));
  channel.bind('SERENO_ACTUALIZADO', (data: any) => callback('SERENO_ACTUALIZADO', data));

  return () => {
    channel.unbind_all();
    pusher.unsubscribe('dashboard-operador');
  };
};

export const subscribeToGlobalEvents = (callback: (event: string, data: any) => void) => {
  const channel = pusher.subscribe('private-operador-global');
  
  channel.bind('SERENO_ACEPTO', (data: any) => callback('SERENO_ACEPTO', data));
  channel.bind('SERENO_RECHAZO_TIMEOUT', (data: any) => callback('SERENO_RECHAZO_TIMEOUT', data));
  channel.bind('SERENO_RECHAZO_MANUAL', (data: any) => callback('SERENO_RECHAZO_MANUAL', data));

  return () => {
    channel.unbind_all();
    pusher.unsubscribe('private-operador-global');
  };
};
