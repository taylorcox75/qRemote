import React, { useState, useEffect } from 'react';
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

export default function EditServerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const { currentServer, disconnect, connectToServer } = useServer();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [basePath, setBasePath] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useHttps, setUseHttps] = useState(false);
  const [bypassAuth, setBypassAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

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
        setBasePath(server.basePath && server.basePath !== '/' ? server.basePath : '');
        setUsername(server.username || '');
        setPassword(server.password || '');
        setUseHttps(server.useHttps || false);
        setBypassAuth(server.bypassAuth || false);
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
        host: host.trim(),
        port: portNum,
        basePath: basePath.trim() || '/',
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
      const server: ServerConfig = {
        id: id!,
        name: name.trim(),
        host: host.trim(),
        port: portNum,
        username: bypassAuth ? '' : username.trim(),
        password: bypassAuth ? '' : password.trim(),
        useHttps,
        bypassAuth,
      };

      const result = await ServerManager.testConnection(server);
      if (result.success) {
        showToast('Connection test successful!', 'success');
      } else {
        showToast(result.error || 'Connection test failed. Please check your settings.', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Connection test failed. Please check your settings.', 'error');
    } finally {
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
                  placeholder="IP Address or Hostname"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.inputRow}>
                <Ionicons name="link-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={port}
                  onChangeText={setPort}
                  placeholder="Port (optional, default: 8080)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.separator, { backgroundColor: colors.surfaceOutline }]} />
              <View style={styles.inputRow}>
                <Ionicons name="git-branch-outline" size={20} color={colors.primary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={basePath}
                  onChangeText={setBasePath}
                  placeholder="Base Path (default: /)"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
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
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: colors.primary }]}
                onPress={handleTest}
                disabled={testing || saving}
              >
                {testing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.testButtonText}>Test Connection</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

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
});

