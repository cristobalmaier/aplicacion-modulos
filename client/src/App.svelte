<script>
  // Componente principal de la UI
  // Barra lateral fija con lista de apps y boton para subir .zip
  // Panel derecho con iframe que carga la app seleccionada
  import { onMount } from 'svelte';
  import * as api from './api';
  import Docs from './Docs.svelte';
  import Login from './components/Login.svelte';
  import { user, isAdmin, signOut } from './stores/auth';

  let apps = [];
  let selected = null;
  let iframeUrl = '';
  let uploading = false;
  let uploadProgress = 0;
  let starting = false;
  let error = '';
  let collapsed = false;
  let view = 'app'; // 'docs' | 'app' (app shows welcome when idle)
  let showAdminAlert = false;
  
  // Handle user authentication state
  $: if ($user) {
    loadApps();
    // Show admin status alert if user is admin
    if ($isAdmin) {
      showAdminAlert = true;
      setTimeout(() => showAdminAlert = false, 5000);
    }
  }

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
    view = 'app'
    starting = true
    try {
      const resp = await api.startApp(app.name)
      iframeUrl = resp.url
    } catch (e) {
      error = e.message || 'Failed to start app'
    } finally {
      starting = false
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
    uploadProgress = 0
    error = ''
    try {
      const { name } = await api.uploadZip(file, (p) => (uploadProgress = p))
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
  .layout { 
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  /* Admin Alert Styles */
  .admin-alert {
    position: fixed;
    top: 1rem;
    right: 1rem;
    padding: 1rem 2rem 1rem 1rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  .admin-message {
    color: #155724;
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    padding: 0.75rem 1.25rem;
    border-radius: 0.25rem;
  }
  
  .user-message {
    color: #856404;
    background-color: #fff3cd;
    border: 1px solid #ffeeba;
    padding: 0.75rem 1.25rem;
    border-radius: 0.25rem;
  }
  
  .close-button {
    margin-left: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
  }
  
  .user-info {
    margin-top: auto;
    padding: 1rem;
    border-top: 1px solid #eaeaea;
  }
  
  .user-email {
    font-size: 0.9rem;
    color: #555;
    margin-bottom: 0.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .logout-button {
    width: 100%;
    padding: 0.5rem;
    background-color: #f8f9fa;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #dc3545;
  }
  
  .logout-button:hover {
    background-color: #f1f3f5;
  }
  .sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: 260px;
    transition: width 0.2s ease;
    border-right: 1px solid #1f2937;
    background: #0b1324;
    color: #e5e7eb;
    display: flex;
    flex-direction: column;
    z-index: 20;
  }
  .sidebar.collapsed { width: 68px; }
  .brand { padding: 14px 12px; font-weight: 700; border-bottom: 1px solid #1f2937; display:flex; align-items:center; gap:8px; }
  .brand button { background: transparent; border: none; color: #e5e7eb; cursor: pointer; font-size: 18px; padding: 6px; border-radius:8px; }
  .brand button:hover { background: rgba(255,255,255,0.08); }
  .brandTitle { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .apps { flex: 1; overflow: auto; padding: 8px; }
  .apps .appItem { margin-bottom: 8px; }
  .groupLabel { font-size: 12px; padding: 8px 10px; font-weight: 700; color: rgba(229,231,235,0.9); margin-bottom: 8px; }
  .appItem { width: 100%; padding: 10px 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; border-radius: 10px; border: 1px solid #1f2a46; background: transparent; color: #ffffff; transition: background .15s ease, border-color .15s ease, transform .05s; }
  .appItem:hover { background: #111a33; border-color: #243455; }
  .appItem:active { transform: translateY(1px); }
  .appItem.active { background: #1b2440; border-color: #223054; }
  .icon { width: 28px; height: 28px; display:grid; place-items:center; background:#16213a; border-radius:8px; }
  .label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badge { font-size: 10px; padding: 2px 6px; border-radius: 999px; background: #374151; color: #e5e7eb; }
  .hideWhenCollapsed { display: inline; }
  .sidebar.collapsed .hideWhenCollapsed { display: none; }
  .footer { padding: 8px; border-top: 1px solid #1f2937; display:flex; flex-direction:column; gap:8px; }
  .addBtn { width: 100%; display: inline-flex; align-items:center; gap:8px; justify-content:center; padding: 10px 12px; background:#1d4ed8; border: 1px solid #1e40af; border-radius: 10px; cursor: pointer; color: white; font-weight:600; }
  .addBtn:hover { filter: brightness(1.08); }
  .secondaryBtn { width: 100%; display:inline-flex; align-items:center; gap:8px; justify-content:center; padding:10px 12px; background:#111a33; color:#e5e7eb; border:1px solid #1f2a46; border-radius:10px; cursor:pointer; }
  .secondaryBtn:hover { filter: brightness(1.12); }
  .secondaryBtn .hideWhenCollapsed { font-weight: 700; }
  .hiddenInput { display: none; }
  .content { position: relative; margin-left: 260px; height: 100vh; display:flex; flex-direction:column; }
  .content.collapsed { margin-left: 68px; }
  iframe { border: 0; width: 100%; height: 100%; background: white; }
  .topbar { height: 48px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; padding: 0 16px; gap: 12px; background:#fff; position: sticky; top:0; z-index:10; }
  .error { color: #b91c1c; font-size: 14px; }
  .status { font-size: 12px; color: #6b7280; }
  .welcome { padding: 24px; }
  .modal {
    position: fixed; inset: 0; background: rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    z-index: 50;
  }
  .modalCard { width: 420px; background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); border: 1px solid #e5e7eb; }
  .progressOuter { height: 10px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
  .progressInner { height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); width: 0%; transition: width .1s linear; }
  .progressIndef { position: relative; overflow: hidden; }
  .progressIndef::before { content: ''; position: absolute; left: -40%; top:0; bottom:0; width: 40%; background: linear-gradient(90deg, rgba(59,130,246,0), rgba(59,130,246,0.7), rgba(59,130,246,0)); animation: slide 1.1s infinite; }
  @keyframes slide { from { left: -40%; } to { left: 100%; } }
  </style>

{#if !$user}
  <Login />
{:else}
  {#if showAdminAlert}
    <div class="admin-alert">
      {#if $isAdmin}
        <div class="admin-message">¡Eres un administrador!</div>
      {:else}
        <div class="user-message">No tienes privilegios de administrador</div>
      {/if}
      <button class="close-button" on:click={() => showAdminAlert = false}>×</button>
    </div>
  {/if}

  <div class="layout">
    <aside class="sidebar {collapsed ? 'collapsed' : ''}">
      <div class="brand">
        <button aria-label="Toggle sidebar" on:click={() => (collapsed = !collapsed)}>☰</button>
        <div class="brandTitle hideWhenCollapsed">Panel</div>
        <div class="user-info hideWhenCollapsed">
          <div class="user-email">{$user?.email}</div>
          <button class="logout-button" on:click={signOut}>Cerrar sesión</button>
        </div>
    </div>
    <div class="apps">
      <div class="groupLabel hideWhenCollapsed" style="margin-top:8px;">Aplicaciones</div>
      {#if apps.length === 0}
        <div class="appItem" style="opacity: 0.7">No apps yet</div>
      {/if}
      {#each apps as app}
        <button type="button" class="appItem {selected?.name === app.name ? 'active' : ''}" on:click={() => selectApp(app)}>
          <div class="icon">🏷️</div>
          <div class="label hideWhenCollapsed">{app.name}</div>
          <span class="badge hideWhenCollapsed">{app.type}</span>
        </button>
      {/each}
    </div>
    <div class="footer">
      <button type="button" class="secondaryBtn" on:click={() => (view = 'docs', selected = null, iframeUrl = '')}>
        <span>📄</span>
        <span class="hideWhenCollapsed">Documentación</span>
      </button>
      <label class="addBtn">
        <span>＋</span>
        <span class="hideWhenCollapsed">Añadir app</span>
        <input class="hiddenInput" type="file" accept=".zip" on:change={onUploadChange} />
      </label>
      </div>
    </aside>

    <section class="content {collapsed ? 'collapsed' : ''}">
      <div class="topbar">
        <div style="flex:1; font-weight:700;">
          {#if view === 'app'}
            {selected ? selected.name : 'Panel'}
          {:else if view === 'docs'}
            Documentación
          {/if}
        </div>
        {#if error}
          <div class="error">{error}</div>
        {/if}
      </div>
    
    {#if view === 'docs'}
      <Docs on:back={() => (view = 'app')} />
    {:else if selected && iframeUrl}
      <iframe
        src={iframeUrl}
        title={selected.name}
        class="app-iframe"
        on:load={() => (starting = false)}
      ></iframe>
    {:else}
      <div class="welcome">
        <h2>Bienvenido al Panel de Control</h2>
        <p>Selecciona una aplicación para comenzar o sube una nueva.</p>
      </div>
    {/if}
  </section>
  
  {#if starting && !uploading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Iniciando {selected?.name}...</p>
    </div>
  {/if}
  
  {#if uploading || starting}
    <div class="modal">
      <div class="modalCard">
        <div style="font-weight:700; margin-bottom:8px;">
          {uploading 
            ? (uploadProgress < 100 ? 'Subiendo aplicación' : 'Procesando archivo') 
            : 'Iniciando aplicación'}
        </div>
        {#if uploading}
          {#if uploadProgress < 100}
            <div class="progressOuter" aria-label="Upload progress" 
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress}>
              <div class="progressInner" style={`width:${uploadProgress}%`}></div>
            </div>
            <div class="status" style="margin-top:8px;">{uploadProgress}%</div>
          {:else}
            <div class="progressOuter progressIndef"></div>
            <div class="status" style="margin-top:8px;">Descomprimiendo y registrando…</div>
          {/if}
        {:else}
          <div class="progressOuter progressIndef"></div>
          <div class="status" style="margin-top:8px;">Esto puede tardar unos segundos…</div>
        {/if}
      </div>
    </div>
  {/if}
</div>
{/if}
