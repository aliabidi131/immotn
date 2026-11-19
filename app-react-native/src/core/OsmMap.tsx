import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import {
  clampZoom,
  panCenter,
  toScreen,
  visibleTiles,
} from './geo';
import type { Coordinates } from './geo';
import { colors } from './theme';

// Carte OpenStreetMap : tuiles raster + marqueurs, sans clé d'API (équivalent
// de flutter_map côté Flutter). Vue contrôlée : le parent détient centre/zoom.

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
}

export interface MapView {
  center: Coordinates;
  zoom: number;
}

interface Props {
  center: Coordinates;
  zoom: number;
  markers: MapMarker[];
  userPosition?: Coordinates | null;
  selectedId?: string | null;
  interactive?: boolean;
  onViewChange?: (view: MapView) => void;
  onMarkerPress?: (id: string) => void;
  onMapPress?: () => void;
}

// L'usage des tuiles OSM exige un User-Agent identifiable (même identifiant
// d'application que Flutter).
const TILE_HEADERS = { 'User-Agent': 'ImmoTN/1.0 (tn.iset.immotn)' };

export default function OsmMap({
  center,
  zoom,
  markers,
  userPosition = null,
  selectedId = null,
  interactive = true,
  onViewChange,
  onMarkerPress,
  onMapPress,
}: Props) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const latest = useRef({ center, zoom, onViewChange });
  latest.current = { center, zoom, onViewChange };
  const startCenter = useRef<Coordinates>(center);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          interactive && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
        onPanResponderGrant: () => {
          startCenter.current = latest.current.center;
        },
        onPanResponderMove: (_event, gesture) => {
          const { zoom: currentZoom, onViewChange: change } = latest.current;
          change?.({
            center: panCenter(
              startCenter.current,
              currentZoom,
              gesture.dx,
              gesture.dy,
            ),
            zoom: currentZoom,
          });
        },
      }),
    [interactive],
  );

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const changeZoom = (delta: number) => {
    onViewChange?.({ center, zoom: clampZoom(zoom + delta) });
  };

  const tiles = visibleTiles(center, zoom, size.width, size.height);

  return (
    <View style={styles.container} onLayout={onLayout} {...responder.panHandlers}>
      {tiles.map(tile => (
        <Image
          key={`${zoom}/${tile.x}/${tile.y}/${tile.left}`}
          source={{
            uri: `https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`,
            headers: TILE_HEADERS,
          }}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
        />
      ))}

      {/* Un appui sur le fond désélectionne (équivalent de onTap Flutter). */}
      {onMapPress ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onMapPress} />
      ) : null}

      {size.width > 0
        ? markers.map(marker => {
            const point = toScreen(
              marker,
              center,
              zoom,
              size.width,
              size.height,
            );
            if (
              point.x < -40 ||
              point.y < -60 ||
              point.x > size.width + 40 ||
              point.y > size.height + 40
            ) {
              return null;
            }
            const selected = marker.id === selectedId;
            return (
              <Pressable
                key={marker.id}
                accessibilityRole="button"
                accessibilityLabel="Annonce sur la carte"
                onPress={() => onMarkerPress?.(marker.id)}
                hitSlop={6}
                style={[
                  styles.marker,
                  { left: point.x - 16, top: point.y - 34 },
                ]}>
                <Text style={[styles.pin, selected && styles.pinSelected]}>
                  📍
                </Text>
              </Pressable>
            );
          })
        : null}

      {size.width > 0 && userPosition ? (
        <View
          pointerEvents="none"
          style={[
            styles.user,
            {
              left:
                toScreen(userPosition, center, zoom, size.width, size.height).x -
                9,
              top:
                toScreen(userPosition, center, zoom, size.width, size.height).y -
                9,
            },
          ]}
        />
      ) : null}

      {interactive ? (
        <View style={styles.zoomControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom avant"
            onPress={() => changeZoom(1)}
            style={styles.zoomButton}>
            <Text style={styles.zoomText}>+</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zoom arrière"
            onPress={() => changeZoom(-1)}
            style={styles.zoomButton}>
            <Text style={styles.zoomText}>−</Text>
          </Pressable>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#E8EEF6',
  },
  tile: { position: 'absolute', width: 256, height: 256 },
  marker: {
    position: 'absolute',
    width: 32,
    height: 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pin: { fontSize: 28 },
  pinSelected: { fontSize: 34 },
  user: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1E6FD9',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  zoomControls: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  zoomText: { fontSize: 22, color: colors.text, fontWeight: '600' },
  attribution: {
    position: 'absolute',
    right: 4,
    bottom: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  attributionText: { fontSize: 10, color: colors.textSecondary },
});
