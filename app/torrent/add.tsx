import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useServer } from '../../context/ServerContext';
import { torrentsApi } from '../../services/api/torrents';

export default function AddTorrentScreen() {
  const router = useRouter();
  const { isConnected } = useServer();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a torrent URL or magnet link');
      return;
    }

    if (!isConnected) {
      Alert.alert('Error', 'Not connected to a server');
      return;
    }

    try {
      setLoading(true);
      await torrentsApi.addTorrent(url.trim());
      Alert.alert('Success', 'Torrent added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add torrent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.label}>Torrent URL or Magnet Link</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="magnet:?xt=urn:btih:..."
          multiline
          numberOfLines={4}
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[styles.addButton, loading && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.addButtonText}>Add Torrent</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  form: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  input: {
    borderWidth: .25,
    borderColor: '#E5E5EA',
    borderRadius: 16,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 100,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

