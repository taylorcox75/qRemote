/**
 * client.ts — Singleton axios-based HTTP client for the qBittorrent WebUI API with cookie auth, retry, and request logging.
 *
 * Key exports: apiClient (singleton ApiClient instance)
 */
import axios, { AxiosInstance, AxiosError, AxiosHeaders } from 'axios';
import { ServerConfig } from '@/types/api';
import { clogDebug, clogInfo, clogWarn, clogError } from '@/services/connectivity-log';

class ApiClient {
  private client: AxiosInstance;
  private currentServer: ServerConfig | null = null;
  private cookies: string = '';
  private retryAttempts: number = 3;

  constructor() {
    this.client = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // In React Native, we need to manually handle cookies
      // withCredentials doesn't work the same way as in browsers
      withCredentials: false,
    });

    // Request interceptor to add cookies and base URL
    this.client.interceptors.request.use(
      (config) => {
        if (!this.currentServer) {
          return Promise.reject(new Error('No server configured'));
        }
        
        const protocol = this.currentServer.useHttps ? 'https' : 'http';
        // Defense-in-depth: strip protocol and trailing colons/slashes from host even if already sanitized
        let host = (this.currentServer.host || '').replace(/^(https?:\/\/)/i, '').replace(/[:\/]+$/, '');
        const port = this.currentServer.port;
        const portNum = port !== undefined && port !== null ? Number(port) : undefined;
        const portPart = portNum !== undefined && !isNaN(portNum) && portNum > 0 ? `:${portNum}` : '';
        
        // Handle base path - ensure it starts with / and doesn't end with /
        let basePath = this.currentServer.basePath || '/';
        if (!basePath.startsWith('/')) {
          basePath = '/' + basePath;
        }
        // If basePath is just '/', set it to empty string to avoid double slashes
        if (basePath === '/') {
          basePath = '';
        } else if (basePath.endsWith('/')) {
          // Remove trailing slash for non-root paths
          basePath = basePath.slice(0, -1);
        }
        
        config.baseURL = `${protocol}://${host}${portPart}${basePath}`;
        
        clogDebug('HTTP', `${config.method?.toUpperCase() || 'REQ'} ${config.baseURL}${config.url || ''}`);
        
        // Add cookies if available
        if (this.cookies) {
          config.headers.Cookie = this.cookies;
        }
        
        // Add Referer header for qBittorrent 5.x compatibility
        config.headers.Referer = config.baseURL + '/';
        
        // Add Origin header for CORS/authentication
        config.headers.Origin = `${protocol}://${host}${portPart}`;
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to capture cookies and handle errors
    this.client.interceptors.response.use(
      (response) => {
        // Extract cookies from response headers
        // React Native/Axios may lowercase headers, so check all variations
        const headers = response.headers || {};
        const setCookieHeader = 
          headers['set-cookie'] || 
          headers['Set-Cookie'] || 
          headers['SET-COOKIE'] ||
          // Also check if headers object has a get method (some implementations)
          (typeof headers.get === 'function' ? headers.get('set-cookie') : null);
        
        if (setCookieHeader) {
          if (Array.isArray(setCookieHeader)) {
            // Join multiple cookies with semicolon and space
            // Also extract CSRF token if present in cookies
            this.cookies = setCookieHeader.map(cookie => {
              return cookie.split(';')[0].trim();
            }).join('; ');
          } else {
            this.cookies = setCookieHeader.split(';')[0].trim();
          }
          clogDebug('HTTP', `Cookies captured: ${this.cookies.substring(0, 60)}...`);
          // console.log('Cookies captured after request:', this.cookies.substring(0, 100));
        } else {
          // Log available headers for debugging
          const headerKeys = Object.keys(headers);
          // console.log('No set-cookie header found. Available headers:', headerKeys);
          // Check if cookies might be in a different format
          if (headerKeys.length > 0) {
            // console.log('Sample header values:', headerKeys.slice(0, 5).map(key => `${key}: ${String(headers[key]).substring(0, 50)}`));
          }
        }
        return response;
      },
      (error: AxiosError) => {
        const reqUrl = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
        const status = error.response?.status;

        // Handle authentication errors
        if (status === 403) {
          this.cookies = '';
          clogError('HTTP', `403 Forbidden — ${reqUrl}`);
          throw new Error('Authentication failed. Please check your credentials.');
        }

        // Handle rate limiting
        if (status === 429) {
          const headers = error.response?.headers ?? {};
          const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
          const waitMsg = retryAfter ? ` Please retry after ${retryAfter} seconds.` : '';
          clogWarn('HTTP', `429 Rate Limited — ${reqUrl}${waitMsg}`);
          throw new Error(`Rate limited by server.${waitMsg}`.trim());
        }

        // Queueing disabled for priority endpoints
        if (status === 409) {
          clogWarn('HTTP', `409 Conflict — ${reqUrl}`);
          throw new Error('Torrent queueing must be enabled in qBittorrent to change priorities.');
        }
        
        // Handle 404 Not Found errors
        if (status === 404) {
          const fullUrl = `${error.config?.baseURL}${error.config?.url}`;
          clogWarn('HTTP', `404 Not Found — ${fullUrl}`);
          throw new Error(`Endpoint not found: ${fullUrl}. Please check your qBittorrent version and API compatibility.`);
        }
        
        // Handle network errors
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          clogError('HTTP', `Network error (${error.code}) — ${reqUrl}`);
          throw new Error('Connection timeout. Please check your server connection.');
        }

        // Handle other errors
        const message = error.response?.data?.toString() || error.message || 'An unknown error occurred';
        clogError('HTTP', `${status ? 'HTTP ' + status : error.code || 'Unknown'} — ${reqUrl}: ${message}`);
        throw new Error(message);
      }
    );
  }

  updateSettings(config: {
    connectionTimeout?: number;
    retryAttempts?: number;
  }) {
    if (config.connectionTimeout !== undefined) {
      this.client.defaults.timeout = config.connectionTimeout;
    }
    if (config.retryAttempts !== undefined) {
      this.retryAttempts = Math.max(0, config.retryAttempts);
    }
  }

  setServer(server: ServerConfig | null) {
    // Only clear cookies if we're switching to a different server or disconnecting
    if (!server || (this.currentServer && this.currentServer.id !== server.id)) {
      this.cookies = '';
    }
    this.currentServer = server;
    if (server) {
      clogInfo('HTTP', `API client set to ${server.host}:${server.port || 'default'}`);
    } else {
      clogInfo('HTTP', 'API client server cleared');
    }
  }

  getServer(): ServerConfig | null {
    return this.currentServer;
  }

  clearCookies() {
    this.cookies = '';
  }

  getCookies(): string {
    return this.cookies;
  }

  async postFormData(url: string, data: FormData): Promise<unknown> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const headers = new AxiosHeaders({ 'Content-Type': 'multipart/form-data' });
    if (this.cookies) {
      headers.set('Cookie', this.cookies);
    }

    const response = await this.client.post(url, data, { headers });
    return response.data;
  }

  async postUrlEncoded(url: string, data: Record<string, string | number | boolean>, signal?: AbortSignal): Promise<unknown> {
    // Check server is configured (interceptor will also check, but fail early with better error)
    if (!this.currentServer) {
      throw new Error('No server configured. Please connect to a server first.');
    }

    // Manually encode the data as URL-encoded string
    const params: string[] = [];
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        const value = String(data[key]);
        params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });
    const body = params.join('&');

    // Let the interceptor handle headers (it already sets Content-Type) and baseURL
    const response = await this.client.post(url, body, { signal });
    return response.data;
  }

  private isRetriableError(error: any): boolean {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ERR_NETWORK' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('timeout')
    );
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        if (attempt < this.retryAttempts && this.isRetriableError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          clogWarn('HTTP', `Retrying request (attempt ${attempt + 1}/${this.retryAttempts})...`);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  // Helper method for GET requests
  async get(url: string, params?: Record<string, any>, signal?: AbortSignal): Promise<any> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    return this.withRetry(async () => {
      const response = await this.client.get(url, { params, signal });
      return response.data;
    });
  }

  // Helper method for POST requests (JSON)
  async post(url: string, data?: any, signal?: AbortSignal): Promise<any> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const response = await this.client.post(url, data, { signal });
    return response.data;
  }
}

export const apiClient = new ApiClient();

