<script>
  import { signIn } from '../stores/auth';
  import { onMount } from 'svelte';
  
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  
  async function handleSubmit() {
    if (!email || !password) {
      error = 'Por favor ingrese email y contraseña';
      return;
    }
    
    try {
      loading = true;
      error = '';
      await signIn(email, password);
    } catch (err) {
      error = err.message || 'Error al iniciar sesión';
    } finally {
      loading = false;
    }
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }
</script>

<div class="login-container">
  <div class="login-box">
    <h2>Iniciar Sesión</h2>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    <div class="form-group">
      <label for="email">Email</label>
      <input 
        id="email"
        type="email" 
        bind:value={email}
        on:keydown={handleKeyDown}
        placeholder="usuario@ejemplo.com"
        disabled={loading}
      />
    </div>
    
    <div class="form-group">
      <label for="password">Contraseña</label>
      <input 
        id="password"
        type="password" 
        bind:value={password}
        on:keydown={handleKeyDown}
        placeholder="••••••••"
        disabled={loading}
      />
    </div>
    
    <button 
      on:click={handleSubmit}
      disabled={loading || !email || !password}
      class="login-button"
    >
      {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
    </button>
    
    <div class="login-hint">
      Usa las credenciales proporcionadas
    </div>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #f5f5f5;
    padding: 1rem;
  }
  
  .login-box {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }
  
  h2 {
    margin-top: 0;
    color: #333;
    text-align: center;
    margin-bottom: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    color: #555;
    font-weight: 500;
  }
  
  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }
  
  input:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.2);
  }
  
  .login-button {
    width: 100%;
    padding: 0.75rem;
    background-color: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .login-button:hover:not(:disabled) {
    background-color: #3a7bc8;
  }
  
  .login-button:disabled {
    background-color: #a0c4ff;
    cursor: not-allowed;
  }
  
  .error-message {
    color: #e74c3c;
    background-color: #fde8e8;
    padding: 0.75rem;
    border-radius: 4px;
    margin-bottom: 1.25rem;
    font-size: 0.9rem;
  }
  
  .login-hint {
    margin-top: 1rem;
    text-align: center;
    color: #777;
    font-size: 0.9rem;
  }
</style>
