import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ServerManager } from '../../services/server-manager';
import { ServerConfig } from '../../types/api';
import { useTheme } from '../../context/ThemeContext';
import { useServer } from '../../context/ServerContext';
import { useToast, ModalToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { spacing, borderRadius } from '../../constants/spacing';
import { shadows } from '../../constants/shadows';
import * as Clipboard from 'expo-clipboard';
import { APP_VERSION } from '../../utils/version';

export default function EditServerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { currentServer, disconnect, connectToServer } = useServer();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useHttps, setUseHttps] = useState(false);
  const [bypassAuth, setBypassAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showHostTooltip, setShowHostTooltip] = useState(false);
  const [showPortTooltip, setShowPortTooltip] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const testAbortController = useRef<AbortController | null>(null);
  // Preserve basePath from existing servers even though we don't show it in UI
  const [preservedBasePath, setPreservedBasePath] = useState<string>('/');

  // Helper function to strip http:// or https:// prefix from host
  const stripProtocol = (hostString: string): string => {
    return hostString.replace(/^(https?:\/\/)/i, '');
  };

  // Computed debug info for troubleshooting
  const debugInfo = useMemo(() => {
    const originalHost = host.trim();
    const hadProtocol = /^https?:\/\//i.test(originalHost);
    const strippedProtocol = hadProtocol ? originalHost.match(/^(https?:\/\/)/i)?.[0] : null;
    const cleanHost = stripProtocol(originalHost);
    
    const protocol = useHttps ? 'https' : 'http';
    const portNum = port.trim() ? parseInt(port, 10) : undefined;
    const portPart = portNum && portNum > 0 ? `:${portNum}` : '';
    const baseUrl = `${protocol}://${cleanHost}${portPart}`;
    
    // Detect issues
    const warnings: Array<{ type: 'error' | 'warning' | 'info'; message: string }> = [];
    
    // Port in host
    const portInHost = cleanHost.match(/:(\d+)/);
    if (portInHost) {
      warnings.push({ type: 'warning', message: `Port ":${portInHost[1]}" detected in host. Move it to the Port field.` });
    }
    
    // Path in host
    const pathMatch = cleanHost.match(/\/(.+)/);
    if (pathMatch) {
      warnings.push({ type: 'warning', message: `Path "/${pathMatch[1]}" detected in host.` });
    }
    
    // Protocol stripped
    if (strippedProtocol) {
      warnings.push({ type: 'info', message: `"${strippedProtocol}" removed. Use the HTTPS toggle instead.` });
    }
    
    // Localhost
    if (/^(localhost|127\.0\.0\.1)$/i.test(cleanHost.split(':')[0].split('/')[0])) {
      warnings.push({ type: 'error', message: "Localhost won't work on mobile. Use your server's network IP." });
    }
    
    // DDNS without port
    const ddnsPatterns = /\.(ddns\.net|duckdns\.org|no-ip\.com|dynu\.com|freedns\.afraid\.org|hopto\.org|zapto\.org|sytes\.net)$/i;
    if (ddnsPatterns.test(cleanHost) && !portNum) {
      warnings.push({ type: 'info', message: "DDNS detected without port. Most need port 8080 unless using a reverse proxy." });
    }
    
    // IP without port
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost.split(':')[0]);
    if (isIP && !portNum) {
      warnings.push({ type: 'info', message: "IP address without port. Usually needs port 8080." });
    }
    
    // HTTPS on private IP
    const isPrivateIP = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(cleanHost);
    if (useHttps && isPrivateIP) {
      warnings.push({ type: 'warning', message: "HTTPS on local IP may fail without a valid certificate." });
    }
    
    // Missing credentials
    if (!bypassAuth && (!username.trim() || !password.trim())) {
      warnings.push({ type: 'error', message: "Username and password required (or enable Bypass Authentication)." });
    }
    
    return {
      originalHost,
      cleanHost,
      hadProtocol,
      strippedProtocol,
      protocol,
      portNum,
      portPart,
      baseUrl,
      loginEndpoint: `${baseUrl}/api/v2/auth/login`,
      versionEndpoint: `${baseUrl}/api/v2/app/version`,
      warnings,
      hasErrors: warnings.some(w => w.type === 'error'),
      hasWarnings: warnings.some(w => w.type === 'warning'),
    };
  }, [host, port, useHttps, bypassAuth, username, password]);

  // Copy debug info to clipboard
  const copyDebugInfo = async () => {
    const debugText = `=== qBitRemote Debug Info ===
Full URL: ${debugInfo.baseUrl}
Protocol: ${debugInfo.protocol}://
Host: ${debugInfo.cleanHost || '(empty)'}
Port: ${debugInfo.portNum || 'default (80/443)'}
HTTPS: ${useHttps ? 'Yes' : 'No'}
Auth Bypass: ${bypassAuth ? 'Yes' : 'No'}

Login Endpoint: ${debugInfo.loginEndpoint}
Version Endpoint: ${debugInfo.versionEndpoint}

${debugInfo.warnings.length > 0 ? 'Warnings/Issues:\n' + debugInfo.warnings.map(w => `- [${w.type.toUpperCase()}] ${w.message}`).join('\n') : 'No warnings detected.'}

App Version: ${APP_VERSION}`;

    try {
      await Clipboard.setStringAsync(debugText);
      showToast('Debug info copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy debug info', 'error');
    }
  };

  const handleCancelTest = () => {
    if (testAbortController.current) {
      testAbortController.current.abort();
      testAbortController.current = null;
    }
    setTesting(false);
  };


  useEffect(() => {
    loadServer();
  }, [id]);

  const loadServer = async () => {
    try {
      const server = await ServerManager.getServer(id!);
      if (server) {
        setName(server.name);
        setHost(server.host);
        const hasPort = server.port != null && server.port > 0;
        setPort(hasPort ? server.port!.toString() : '');
        setUsername(server.username || '');
        setPassword(server.password || '');
        setUseHttps(server.useHttps || false);
        setBypassAuth(server.bypassAuth || false);
        // Preserve existing basePath for backward compatibility
        setPreservedBasePath(server.basePath || '/');
      } else {
        showToast('Server not found', 'error');
        router.back();
      }
    } catch (error) {
      showToast('Failed to load server', 'error');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !host.trim()) {
      showToast('Please fill in server name and host', 'error');
      return;
    }

    if (!bypassAuth && (!username.trim() || !password.trim())) {
      showToast('Please fill in username and password, or enable bypass authentication', 'error');
      return;
    }

    const portNum = port.trim() ? parseInt(port, 10) : undefined;
    if (portNum !== undefined && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      showToast('Please enter a valid port number (1-65535)', 'error');
      return;
    }

    try {
      setSaving(true);
      
      // If editing the currently connected server, disconnect first
      if (currentServer?.id === id) {
        await disconnect();
      }
      
      const server: ServerConfig = {
        id: id!,
        name: name.trim(),
        host: stripProtocol(host.trim()),
        port: portNum,
        basePath: preservedBasePath, // Preserve existing basePath for backward compatibility
        username: bypassAuth ? '' : username.trim(),
        password: bypassAuth ? '' : password.trim(),
        useHttps,
        bypassAuth,
      };

      await ServerManager.saveServer(server);
      showToast('Server saved successfully', 'success');
      router.back();
    } catch (error) {
      showToast('Failed to save server', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await ServerManager.deleteServer(id!);
      showToast(`Server "${name}" deleted`, 'success');
      router.back();
    } catch (error) {
      showToast('Failed to delete server', 'error');
    }
  };

  const handleTest = async () => {
    if (!name.trim() || !host.trim()) {
      showToast('Please fill in server name and host', 'error');
      return;
    }

    if (!bypassAuth && (!username.trim() || !password.trim())) {
      showToast('Please fill in username and password, or enable bypass authentication', 'error');
      return;
    }

    const portNum = port.trim() ? parseInt(port, 10) : undefined;
    if (portNum !== undefined && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      showToast('Please enter a valid port number (1-65535)', 'error');
      return;
    }

    try {
      setTesting(true);
      testAbortController.current = new AbortController();
      
      const server: ServerConfig = {
        id: id!,
        name: name.trim(),
        host: stripProtocol(host.trim()),
        port: portNum,
        username: bypassAuth ? '' : username.trim(),
        password: bypassAuth ? '' : password.trim(),
        useHttps,
        bypassAuth,
      };

      const result = await ServerManager.testConnection(server, testAbortController.current.signal);
      
      if (result.success) {
        showToast('Connection test successful!', 'success');
      } else {
        showToast(result.error || 'Connection test failed. Please check your settings.', 'error');
      }
    } catch (error: any) {
      // Only show error if not cancelled
      if (error.name !== 'AbortError' && 
          error.name !== 'CanceledError' && 
          error.code !== 'ERR_CANCELED' &&
          !error.message?.includes('cancel')) {
        showToast(error.message || 'Connection test failed. Please check your settings.', 'error');
      }
    } finally {
      testAbortController.current = null;
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FocusAwareStatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.surfaceOutline }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButtonLeft}>
            <Text 
              style={[styles.headerButtonText, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Cancel
            </Text>
          </TouchableOpacity>
          <Text 
            style={[styles.headerTitle, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            Edit Server
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.headerButtonRight}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text 
                style={[styles.headerButtonText, { color: colors.primary, fontWeight: '600' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Server Info Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>SERVER INFO</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.inputRow}>
                <Ionicons name="server-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Server Name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.inputRow}>
                <Ionicons name="globe-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={host}
                  onChangeText={setHost}
                  placeholder="IP  / Domain"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                />
                <TouchableOpacity onPress={() => setShowHostTooltip(true)} style={styles.infoButton}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.inputRow}>
                <Ionicons name="link-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={port}
                  onChangeText={setPort}
                  placeholder="Port (optional)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
                <TouchableOpacity onPress={() => setShowPortTooltip(true)} style={styles.infoButton}>
                  <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Authentication Section */}
          {!bypassAuth && (
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>AUTHENTICATION</Text>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.inputRow}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="none"
                  autoComplete="off"
                />
                </View>
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                <View style={styles.inputRow}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="off"
                  passwordRules=""
                />
                </View>
              </View>
            </View>
          )}

          {/* Security Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>SECURITY</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Use HTTPS</Text>
                </View>
                <Switch
                  value={useHttps}
                  onValueChange={setUseHttps}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="lock-open-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                  <View>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>Bypass Authentication</Text>
                    <Text style={[styles.settingHint, { color: colors.textSecondary }]}>Skip login when local network auth is off</Text>
                  </View>
                </View>
                <Switch
                  value={bypassAuth}
                  onValueChange={setBypassAuth}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Test Connection */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>CONNECTION TEST</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {testing ? (
                <View style={styles.testingContainer}>
                  <View style={styles.testingContent}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.testingText, { color: colors.text }]}>Testing connection...</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.cancelButton, { backgroundColor: colors.error }]}
                    onPress={handleCancelTest}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.testButton, { backgroundColor: colors.primary }]}
                  onPress={handleTest}
                  disabled={saving}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.testButtonText}>Test Connection</Text>
                </TouchableOpacity>
              )}
              
              {/* Debug Toggle */}
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name="bug-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Debug Mode</Text>
                </View>
                <Switch
                  value={showDebugInfo}
                  onValueChange={setShowDebugInfo}
                  trackColor={{ false: colors.surfaceOutline, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>

          {/* Debug Info - Only shown when toggle is ON */}
          {showDebugInfo && (
            <View style={styles.section}>
              <View style={styles.debugHeaderRow}>
                <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
                  DEBUG INFO {debugInfo.hasErrors ? '⚠' : debugInfo.hasWarnings ? '!' : '✓'}
                </Text>
                <TouchableOpacity 
                  onPress={copyDebugInfo}
                  style={styles.copyButton}
                  accessibilityLabel="Copy debug info to clipboard"
                >
                  <Ionicons name="copy-outline" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                {/* Full URL */}
                <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: colors.textSecondary }]}>Full URL</Text>
                  <Text style={[styles.debugValue, { color: colors.text }]} selectable>
                    {debugInfo.baseUrl}
                  </Text>
                </View>
                
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                
                {/* Breakdown */}
                <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: colors.textSecondary }]}>Protocol</Text>
                  <Text style={[styles.debugValue, { color: colors.text }]}>{debugInfo.protocol}://</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: colors.textSecondary }]}>Host</Text>
                  <Text style={[styles.debugValue, { color: colors.text }]}>{debugInfo.cleanHost || '(empty)'}</Text>
                </View>
                <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: colors.textSecondary }]}>Port</Text>
                  <Text style={[styles.debugValue, { color: colors.text }]}>
                    {debugInfo.portNum || 'default (80/443)'}
                  </Text>
                </View>
                
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                
                {/* Endpoints */}
                <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: colors.textSecondary }]}>Login API</Text>
                  <Text style={[styles.debugValue, { color: colors.text }]} selectable numberOfLines={2}>
                    {debugInfo.loginEndpoint}
                  </Text>
                </View>
                
                <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
                
                {/* Warnings */}
                {debugInfo.warnings.length > 0 && (
                  <View style={styles.debugWarnings}>
                    {debugInfo.warnings.map((w, i) => (
                      <View 
                        key={i} 
                        style={[
                          styles.debugWarningRow,
                          { backgroundColor: w.type === 'error' ? colors.error + '20' : 
                                             w.type === 'warning' ? colors.warning + '20' : 
                                             colors.primary + '15' }
                        ]}
                      >
                        <Ionicons 
                          name={w.type === 'error' ? 'alert-circle' : 
                                w.type === 'warning' ? 'warning' : 'information-circle'} 
                          size={16} 
                          color={w.type === 'error' ? colors.error : 
                                 w.type === 'warning' ? colors.warning : colors.primary} 
                        />
                        <Text style={[styles.debugWarningText, { color: colors.text }]}>
                          {w.message}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {debugInfo.warnings.length === 0 && (
                  <View style={[styles.debugWarningRow, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.debugWarningText, { color: colors.text }]}>
                      Configuration looks good!
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Danger Zone */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.error }]}>DANGER ZONE</Text>
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <TouchableOpacity style={styles.dangerRow} onPress={handleDelete}>
                <View style={styles.dangerLeft}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} style={styles.inputIcon} />
                  <Text style={[styles.dangerLabel, { color: colors.error }]}>Delete Server</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      
      {/* Host Tooltip Modal */}
      <Modal
        visible={showHostTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHostTooltip(false)}
      >
        <TouchableOpacity 
          style={styles.tooltipOverlay} 
          activeOpacity={1} 
          onPress={() => setShowHostTooltip(false)}
        >
          <View style={[styles.tooltipContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.tooltipHeader}>
              <Ionicons name="globe-outline" size={24} color={colors.primary} />
              <Text style={[styles.tooltipTitle, { color: colors.text }]}>Host Address</Text>
            </View>
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              Enter your server's address without http:// or https://
            </Text>
            <Text style={[styles.tooltipText, { color: colors.text, marginTop: 12 }]}>
              Examples:
            </Text>
            <Text style={[styles.tooltipExample, { color: colors.textSecondary }]}>
              • 192.168.1.100{'\n'}
              • qbittorrent.example.com{'\n'}
              • example.com/qbt
            </Text>
            <TouchableOpacity 
              style={[styles.tooltipButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowHostTooltip(false)}
            >
              <Text style={styles.tooltipButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Port Tooltip Modal */}
      <Modal
        visible={showPortTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPortTooltip(false)}
      >
        <TouchableOpacity 
          style={styles.tooltipOverlay} 
          activeOpacity={1} 
          onPress={() => setShowPortTooltip(false)}
        >
          <View style={[styles.tooltipContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.tooltipHeader}>
              <Ionicons name="link-outline" size={24} color={colors.primary} />
              <Text style={[styles.tooltipTitle, { color: colors.text }]}>Port</Text>
            </View>
            <Text style={[styles.tooltipText, { color: colors.text }]}>
              Specify the port number if your server uses a custom port.
            </Text>
            <Text style={[styles.tooltipText, { color: colors.text, marginTop: 12 }]}>
              Leave blank if you're using:
            </Text>
            <Text style={[styles.tooltipExample, { color: colors.textSecondary }]}>
              • A domain name (example.com){'\n'}
              • A reverse proxy{'\n'}
            </Text>
            <Text style={[styles.tooltipText, { color: colors.text, marginTop: 12 }]}>
              Common qBittorrent port: 8080
            </Text>
            <TouchableOpacity 
              style={[styles.tooltipButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowPortTooltip(false)}
            >
              <Text style={styles.tooltipButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ModalToast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerButtonLeft: {
    minWidth: 60,
    alignItems: 'flex-start',
  },
  headerButtonRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  headerButtonText: {
    fontSize: 17,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  separator: {
    height: 1,
    marginLeft: 48,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
  },
  settingHint: {
    fontSize: 12,
    marginTop: 1,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dangerLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    margin: spacing.md,
    minHeight: 50,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  testingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    margin: spacing.md,
    minHeight: 50,
  },
  testingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  testingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.small,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  infoButton: {
    padding: 4,
    marginLeft: 8,
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  tooltipContainer: {
    borderRadius: borderRadius.large,
    padding: spacing.xl,
    maxWidth: 400,
    width: '100%',
    ...shadows.card,
  },
  tooltipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  tooltipText: {
    fontSize: 15,
    lineHeight: 22,
  },
  tooltipExample: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginLeft: 4,
  },
  tooltipButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
  },
  tooltipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Debug panel styles
  debugHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  copyButton: {
    padding: 8,
    marginRight: 4,
  },
  debugRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  debugLabel: {
    width: 70,
    fontSize: 12,
    fontWeight: '600',
  },
  debugValue: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  debugWarnings: {
    padding: 8,
    gap: 8,
  },
  debugWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  debugWarningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

