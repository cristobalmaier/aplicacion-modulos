<script>
  // Componente principal de la UI
  // Barra lateral fija con lista de apps y boton para subir .zip
  // Panel derecho con iframe que carga la app seleccionada
  import { onMount } from 'svelte'
  import * as api from './api'

  let apps = []
  let selected = null 
  let iframeUrl = ''
  let uploading = false
  let error = ''

  // Carga la lista de aplicaciones desde el backend
  async function loadApps(selectName = null) {
    try {
      const list = await api.listApps()
      apps = list.sort((a, b) => a.name.localeCompare(b.name))
      if (selectName) {
        const found = apps.find((a) => a.name === selectName)
        if (found) await selectApp(found)
      }
    } catch (e) {
      error = e.message || 'Failed to load apps'
    }
  }

  // Seleccionar una app y solicitar al backend su URL (inicia si es necesario)
  async function selectApp(app) {
    error = ''
    selected = app
    iframeUrl = ''
    try {
      const resp = await api.startApp(app.name)
      iframeUrl = resp.url
    } catch (e) {
      error = e.message || 'Failed to start app'
    }
  }

  // Maneja el upload de .zip y refresca la lista
  async function onUploadChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      error = 'Only .zip files are allowed.'
      return
    }
    uploading = true
    error = ''
    try {
      const { name } = await api.uploadZip(file)
      await loadApps(name)
    } catch (e) {
      error = e.message || 'Upload failed'
    } finally {
      uploading = false
      e.target.value = ''
    }
  }

  // Inicializacion: cargar lista al montar el componente
  onMount(() => {
    loadApps()
  })
</script>

<style>
  /* Estilos basicos del layout */
  .layout { display: grid; grid-template-columns: 260px 1fr; height: 100vh; }
  .sidebar {
    border-right: 1px solid #e5e7eb;
    background: #0b1324;
    color: #e5e7eb;
    display: flex;
    flex-direction: column;
  }
  .brand { padding: 16px; font-weight: 600; border-bottom: 1px solid #1f2937; }
  .apps { flex: 1; overflow: auto; }
  .appItem { padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .appItem:hover { background: #111a33; }
  .appItem.active { background: #1b2440; }
  .badge { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: #374151; color: #e5e7eb; }
  .footer { padding: 12px 16px; border-top: 1px solid #1f2937; }
  .addBtn { display: inline-block; padding: 10px 12px; border: 1px dashed #6b7280; border-radius: 8px; cursor: pointer; color: #e5e7eb; }
  .addBtn:hover { background: #111827; }
  .hiddenInput { display: none; }
  .content { position: relative; }
  iframe { border: 0; width: 100%; height: 100%; background: white; }
  .topbar { height: 48px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; padding: 0 16px; gap: 12px; }
  .error { color: #b91c1c; font-size: 14px; }
  .status { font-size: 12px; color: #6b7280; }
</style>

<div class="layout">
  <aside class="sidebar">
    <div class="brand">App Launcher</div>
    <div class="apps">
      {#if apps.length === 0}
        <div class="appItem" style="opacity: 0.7">No apps yet. Add one below.</div>
      {/if}
      {#each apps as app}
        <div class="appItem {selected?.name === app.name ? 'active' : ''}" on:click={() => selectApp(app)}>
          <span style="flex:1">{app.name}</span>
          <span class="badge">{app.type}</span>
        </div>
      {/each}
    </div>
    <div class="footer">
      <label class="addBtn">
        + Add App (.zip)
        <input class="hiddenInput" type="file" accept=".zip" on:change={onUploadChange} />
      </label>
      {#if uploading}
        <div class="status" style="margin-top:8px">Uploading...</div>
      {/if}
    </div>
  </aside>

  <section class="content">
    <div class="topbar">
      <div style="flex:1; font-weight:600;">{selected ? selected.name : 'Select an app'}</div>
      {#if error}
        <div class="error">{error}</div>
      {/if}
    </div>
    {#if iframeUrl}
      <iframe src={iframeUrl} title={selected?.name}></iframe>
    {:else}
      <div style="padding:24px; color:#6b7280;">Choose an app from the left to load it here.</div>
    {/if}
  </section>
</div>
