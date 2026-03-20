/** Централизованная конфигурация API */

export const API_URL = import.meta.env.VITE_API_URL || '';
export const WS_URL = import.meta.env.VITE_WS_URL || `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}/ws`;
