import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ServerManager } from '../../services/server-manager';
import { ServerConfig } from '../../types/api';
import { useTheme } from '../../context/ThemeContext';
import { FocusAwareStatusBar } from '../../components/FocusAwareStatusBar';

export default function EditServerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, isDark } = useTheme();
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [noPort, setNoPort] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [useHttps, setUseHttps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        setNoPort(!hasPort);
        setUsername(server.username);
        setPassword(server.password);
        setUseHttps(server.useHttps || false);
      } else {
        Alert.alert('Error', 'Server not found');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load server');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !host.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const portNum = noPort ? undefined : (port.trim() ? parseInt(port, 10) : undefined);
    if (!noPort && portNum !== undefined && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      Alert.alert('Error', 'Please enter a valid port number (1-65535)');
      return;
    }

    try {
      setSaving(true);
      const server: ServerConfig = {
        id: id!,
        name: name.trim(),
        host: host.trim(),
        port: portNum,
        username: username.trim(),
        password: password.trim(),
        useHttps,
      };

      await ServerManager.saveServer(server);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save server');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Server',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ServerManager.deleteServer(id!);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete server');
            }
          },
        },
      ]
    );
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
                  style={[styles.input, { color: noPort ? colors.textSecondary : colors.text }]}
                  value={noPort ? 'N/A' : port}
                  onChangeText={setPort}
                  placeholder="Port (optional)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  editable={!noPort}
                />
                <TouchableOpacity 
                  style={[styles.naButton, noPort && { backgroundColor: colors.primary }]}
                  onPress={() => setNoPort(!noPort)}
                >
                  <Text style={[styles.naButtonText, { color: noPort ? '#FFFFFF' : colors.textSecondary }]}>N/A</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Authentication Section */}
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
                />
              </View>
            </View>
          </View>

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
  naButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: .8,
    borderColor: '#666',
  },
  naButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

