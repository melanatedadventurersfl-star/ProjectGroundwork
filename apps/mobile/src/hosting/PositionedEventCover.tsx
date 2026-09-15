import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { getEventCoverPosition, type EventCoverPosition } from './eventMedia';

export function PositionedEventCover({
  adventureId,
  imageUrl,
  style,
}: {
  adventureId: string;
  imageUrl: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [position, setPosition] = useState<EventCoverPosition>({ focalX: 0.5, focalY: 0.5, zoom: 1 });
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    let active = true;
    void getEventCoverPosition(adventureId)
      .then((next) => { if (active) setPosition(next); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [adventureId, imageUrl]);

  const translateX = (0.5 - position.focalX) * size.width * 0.72;
  const translateY = (0.5 - position.focalY) * size.height * 0.72;

  return <View
    style={[styles.frame, style]}
    onLayout={(event) => setSize({
      width: Math.max(1, event.nativeEvent.layout.width),
      height: Math.max(1, event.nativeEvent.layout.height),
    })}
  >
    <Image
      source={{ uri: imageUrl }}
      resizeMode="cover"
      style={[styles.image, { transform: [{ translateX }, { translateY }, { scale: position.zoom }] }]}
    />
  </View>;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: '#18221C' },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
