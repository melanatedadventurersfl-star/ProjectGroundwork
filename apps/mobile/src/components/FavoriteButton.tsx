import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

type FavoriteButtonProps = {
  saved: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function FavoriteButton({
  saved,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: FavoriteButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (saved ? 'Remove from favorites' : 'Add to favorites')}
      accessibilityState={{ selected: saved, disabled }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled, style]}
      onPress={onPress}
    >
      <Text style={[styles.star, saved && styles.starSaved]}>{saved ? '★' : '☆'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10,16,13,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    color: '#F4C542',
    fontSize: 21,
    lineHeight: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  starSaved: {
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
