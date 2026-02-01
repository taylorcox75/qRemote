import React, { useState, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ServerManager } from '../../services/server-manager';
import { ServerConfig } from '../../types/api';
import { useTheme } from '../../context/ThemeContext';
import { useServer } from '../../context/ServerContext';
import { useToast, ModalToast } from '../../context/ToastContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';
import { spacing, borderRadius } from '../../constants/spacing';
import { shadows } from '../../constants/shadows';

export default function AddServerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { connectToServer } = useServer();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useHttps, setUseHttps] = useState(false);
  const [bypassAuth, setBypassAuth] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showHostTooltip, setShowHostTooltip] = useState(false);
  const [showPortTooltip, setShowPortTooltip] = useState(false);
  const testAbortController = useRef<AbortController | null>(null);

  // Helper function to strip http:// or https:// prefix from host
  const stripProtocol = (hostString: string): string => {
    return hostString.replace(/^(https?:\/\/)/i, '');
  };

  const handleCancelTest = () => {
    if (testAbortController.current) {
      testAbortController.current.abort();
      testAbortController.current = null;
    }
    setTesting(false);
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

    const portNum = (port.trim() ? parseInt(port, 10) : undefined);
    if (portNum !== undefined && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      showToast('Please enter a valid port number (1-65535)', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Check if this will be the first server
      const existingServers = await ServerManager.getServers();
      const isFirstServer = existingServers.length === 0;
      
      const server: ServerConfig = {
        id: Date.now().toString(),
        name: name.trim(),
        host: stripProtocol(host.trim()),
        port: portNum,
        basePath: '/',
        username: bypassAuth ? '' : username.trim(),
        password: bypassAuth ? '' : password.trim(),
        useHttps,
        bypassAuth,
      };

      await ServerManager.saveServer(server);
      showToast('Server saved successfully', 'success');
      
      // If this is the first server, auto-connect
      if (isFirstServer) {
        try {
          const connected = await connectToServer(server);
          if (!connected) {
            showToast('Connection failed. Please check your settings and try connecting manually.', 'warning');
          }
        } catch (error: any) {
          showToast(`Connection failed: ${error.message || 'Unknown error'}. Please try connecting manually.`, 'warning');
        }
      }
      
      router.back();
    } catch (error) {
      showToast('Failed to save server', 'error');
    } finally {
      setLoading(false);
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

    const portNum = (port.trim() ? parseInt(port, 10) : undefined);
    if (portNum !== undefined && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      showToast('Please enter a valid port number (1-65535)', 'error');
      return;
    }

    try {
      setTesting(true);
      testAbortController.current = new AbortController();
      
      const server: ServerConfig = {
        id: 'test-' + Date.now().toString(),
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
            Add Server
          </Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.headerButtonRight}
            disabled={loading}
          >
            {loading ? (
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
                  placeholder="IP / Domain"
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
                  disabled={loading}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.testButtonText}>Test Connection</Text>
                </TouchableOpacity>
              )}
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
    paddingBottom: 40,
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
  naButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: .25,
    borderColor: '#666',
  },
  naButtonText: {
    fontSize: 13,
    fontWeight: '600',
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
});

