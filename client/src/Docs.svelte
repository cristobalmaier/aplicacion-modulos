<script>
  // Simple docs page
  export let onBack = () => {}
</script>

<style>
  .docs {
    padding: 24px;
    line-height: 1.6;
    color: #0f172a;
  }
  h1 { font-size: 24px; margin: 0 0 12px 0; }
  h2 { font-size: 18px; margin: 24px 0 8px 0; }
  p { margin: 8px 0; }
  .card {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 16px;
  }
  .backBtn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #0b1324;
    color: #e5e7eb;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .backBtn:hover { filter: brightness(1.1); }
</style>

<div class="docs">
  <button class="backBtn" on:click={onBack}>
    ← Volver
  </button>

  <div class="card" style="margin-top:16px;">
    <h1>Documentación</h1>
    <p>Aquí encontrarás guías para subir, iniciar y administrar tus aplicaciones.</p>

    <h2>Subir una aplicación</h2>
    <p>Usa el botón "Añadir app" en la barra lateral y selecciona un archivo .zip con tu proyecto.</p>

    <h2>Tipos de aplicaciones soportadas</h2>
    <ul>
      <li>Node/React/Next: scripts estándar desde package.json</li>
      <li>Svelte/SvelteKit (Vite): se inicia con "dev/serve/preview" y puerto asignado</li>
      <li>PHP: servidor embebido de PHP</li>
      <li>HTML Estática: servida directamente</li>
    </ul>

    <h2>Resolución de problemas</h2>
    <p>Revisa la salida del servidor para detalles de instalación y arranque.</p>
  </div>
</div>
