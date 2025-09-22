// Punto de entrada del cliente
// Monta el componente App en el div #app
import './styles.css';
import App from './App.svelte';
import { initAuth } from './stores/auth';

// Initialize authentication
initAuth().then(() => {
  // Initialize the app after auth is ready
  const app = new App({
    target: document.getElementById('app'),
  });
  
  // Expose app for debugging
  window.app = app;
});

export default app;
