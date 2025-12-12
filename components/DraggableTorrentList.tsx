import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { TorrentInfo } from '../types/api';
import { TorrentCard } from './TorrentCard';
import { useTheme } from '../context/ThemeContext';
import { torrentsApi } from '../services/api/torrents';

interface DraggableTorrentListProps {
  torrents: TorrentInfo[];
  onReorder?: (data: TorrentInfo[]) => void;
  onTorrentPress: (hash: string) => void;
  viewMode?: 'compact' | 'expanded';
}

/**
 * Draggable torrent list for manual priority reordering
 * Long press and drag to reorder torrents
 */
export function DraggableTorrentList({
  torrents,
  onReorder,
  onTorrentPress,
  viewMode = 'compact',
}: DraggableTorrentListProps) {
  const { colors } = useTheme();

  const handleDragEnd = async ({ data }: { data: TorrentInfo[] }) => {
    onReorder?.(data);

    // Update priorities based on new order
    try {
      // Set priorities: top item = highest priority
      for (let i = 0; i < data.length; i++) {
        const priority = data.length - i; // Reverse order for priority
        await torrentsApi.setTorrentPriority([data[i].hash], priority);
      }
    } catch (error) {
      console.error('Failed to update priorities:', error);
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<TorrentInfo>) => (
    <ScaleDecorator>
      <View
        style={[
          styles.itemContainer,
          isActive && { opacity: 0.8, elevation: 8 },
        ]}
      >
        <TorrentCard
          torrent={item}
          viewMode={viewMode}
          onPress={() => onTorrentPress(item.hash)}
        />
      </View>
    </ScaleDecorator>
  );

  return (
    <DraggableFlatList
      data={torrents}
      renderItem={renderItem}
      keyExtractor={(item) => item.hash}
      onDragEnd={handleDragEnd}
      containerStyle={{ backgroundColor: colors.background }}
    />
  );
}

const styles = StyleSheet.create({
  itemContainer: {
    backgroundColor: 'transparent',
  },
});


