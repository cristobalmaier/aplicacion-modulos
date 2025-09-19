// Punto de entrada del cliente
// Monta el componente App en el div #app
import './styles.css';
import App from './App.svelte';

const app = new App({
  target: document.getElementById('app'),
});

export default app;
