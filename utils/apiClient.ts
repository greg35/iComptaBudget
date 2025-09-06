// Client API générique avec base dynamique et support reverse proxy / sous-chemins.
// Ordre de résolution:
// 1. window.__API_BASE__ explicitement injecté (ex: via script dans index.html ou nginx sub_filter)
// 2. variable d'environnement VITE_API_BASE (build-time)
// 3. meta[name="api-base"].content (injection HTML)
// 4. Détection sous-chemin: meta[name="app-base"], sinon calcul à partir de window.__APP_BASE_PATH__
// 5. Fallback chemin relatif "" (les requêtes /api... vers racine du domaine)

interface RuntimeWindow extends Window { __API_BASE__?: string; __APP_BASE_PATH__?: string; }

function readMeta(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  return el?.content?.trim() || undefined;
}

export function getApiBase(): string {
  const w: RuntimeWindow | undefined = typeof window !== 'undefined' ? (window as RuntimeWindow) : undefined;
  const winBase = w?.__API_BASE__;
  let envBase: string | undefined;
  try { envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined; } catch {}
  const metaApi = readMeta('api-base');
  if (winBase) return winBase.replace(/\/$/, '');
  if (envBase) return envBase.replace(/\/$/, '');
  if (metaApi) return metaApi.replace(/\/$/, '');

  // Gestion sous-chemin: si l'app est servie sous /budget par ex. et API proxifiée aussi sous ce sous-chemin
  const appBase = w?.__APP_BASE_PATH__ || readMeta('app-base');
  if (appBase) {
    const cleaned = appBase.replace(/\/*$/, '');
    // On suppose que l'API est accessible à la racine du sous-chemin: /budget/api
    return cleaned;
  }
  return '';
}

export async function apiFetch(path: string, init?: RequestInit) {
  const base = getApiBase();
  
  // Ajouter le token d'authentification si disponible
  const token = localStorage.getItem('auth_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...init?.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const updatedInit: RequestInit = {
    ...init,
    headers,
  };
  
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return fetch(path, updatedInit);
  }
  // Si base contient un sous-chemin et path commence par /api, on concatène: /budget + /api/...
  const url = base && path.startsWith('/api') ? `${base}${path}` : (path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);
  
  const response = await fetch(url, updatedInit);
  
  // Si la réponse indique que l'authentification a échoué, rediriger vers la page de connexion
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.reload(); // Forcer le rechargement pour afficher l'écran de connexion
  }
  
  return response;
}

// Helper pour construire des URLs d'API (utile dans des libs hors React)
export function apiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = getApiBase();
  return base && path.startsWith('/api') ? `${base}${path}` : (path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);
}
