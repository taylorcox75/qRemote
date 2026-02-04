import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ServerConfig } from '../../types/api';

class ApiClient {
  private client: AxiosInstance;
  private currentServer: ServerConfig | null = null;
  private cookies: string = '';
  private csrfToken: string = '';

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
        
        config.baseURL = `${protocol}://${this.currentServer.host}${portPart}${basePath}`;
        
        // Add cookies if available
        if (this.cookies) {
          config.headers.Cookie = this.cookies;
        }
        
        // Add Referer header for qBittorrent 5.x compatibility
        config.headers.Referer = config.baseURL + '/';
        
        // Add Origin header for CORS/authentication
        config.headers.Origin = `${protocol}://${this.currentServer.host}${portPart}`;
        
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
              // Extract just the cookie name=value part (before semicolon if there are attributes)
              const cookieValue = cookie.split(';')[0].trim();
              
              // Check for CSRF token in cookie (qBittorrent 5.x)
              if (cookieValue.toLowerCase().startsWith('sid=')) {
                // Extract SID token which is used as CSRF in qBittorrent 5.x
                const sidMatch = cookieValue.match(/SID=([^;]+)/i);
                if (sidMatch) {
                  this.csrfToken = sidMatch[1];
                }
              }
              
              return cookieValue;
            }).join('; ');
          } else {
            // Extract just the cookie name=value part
            this.cookies = setCookieHeader.split(';')[0].trim();
            
            // Check for CSRF token in cookie
            const sidMatch = this.cookies.match(/SID=([^;]+)/i);
            if (sidMatch) {
              this.csrfToken = sidMatch[1];
            }
          }
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
        // Handle authentication errors
        if (error.response?.status === 403) {
          this.cookies = '';
          throw new Error('Authentication failed. Please check your credentials.');
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter =
            (error.response.headers as any)?.['retry-after'] ??
            (error.response.headers as any)?.['Retry-After'];
          const waitMsg = retryAfter ? ` Please retry after ${retryAfter} seconds.` : '';
          throw new Error(`Rate limited by server.${waitMsg}`.trim());
        }

        // Queueing disabled for priority endpoints
        if (error.response?.status === 409) {
          throw new Error('Torrent queueing must be enabled in qBittorrent to change priorities.');
        }
        
        // Handle 404 Not Found errors
        if (error.response?.status === 404) {
          const fullUrl = `${error.config?.baseURL}${error.config?.url}`;
          throw new Error(`Endpoint not found: ${fullUrl}. Please check your qBittorrent version and API compatibility.`);
        }
        
        // Handle network errors
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          throw new Error('Connection timeout. Please check your server connection.');
        }

        // Handle other errors
        const message = error.response?.data?.toString() || error.message || 'An unknown error occurred';
        throw new Error(message);
      }
    );
  }

  setServer(server: ServerConfig | null) {
    // Only clear cookies if we're switching to a different server or disconnecting
    if (!server || (this.currentServer && this.currentServer.id !== server.id)) {
      this.cookies = '';
      this.csrfToken = '';
    }
    this.currentServer = server;
  }

  getServer(): ServerConfig | null {
    return this.currentServer;
  }

  clearCookies() {
    this.cookies = '';
    this.csrfToken = '';
  }

  getCookies(): string {
    return this.cookies;
  }
  
  getCsrfToken(): string {
    return this.csrfToken;
  }

  // Helper method for form data requests
  async postFormData(url: string, data: FormData): Promise<any> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const config: InternalAxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      } as any,
    };

    if (this.cookies) {
      config.headers!.Cookie = this.cookies;
    }

    const response = await this.client.post(url, data, config);
    return response.data;
  }

  // Helper method for URL-encoded requests
  async postUrlEncoded(url: string, data: Record<string, any>, signal?: AbortSignal): Promise<any> {
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

  // Helper method for GET requests
  async get(url: string, params?: Record<string, any>, signal?: AbortSignal): Promise<any> {
    if (!this.currentServer) {
      throw new Error('No server configured');
    }

    const response = await this.client.get(url, { params, signal });
    return response.data;
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

