// Cliente HTTP para comunicarse con el backend
// Expone funciones para listar apps, subir .zip e iniciar una app
import axios from 'axios';

// Obtener lista de aplicaciones registradas
export async function listApps() {
  const { data } = await axios.get('/api/apps');
  return data;
}

// Subir un archivo .zip con el campo "file"
export async function uploadZip(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await axios.post('/api/apps/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// Iniciar una aplicacion por nombre (node/php) o devolver URL si es estatica
export async function startApp(name) {
  const { data } = await axios.post(`/api/apps/${encodeURIComponent(name)}/start`);
  return data;
}
