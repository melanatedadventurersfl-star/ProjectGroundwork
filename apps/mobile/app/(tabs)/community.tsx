import { Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';

import OutpostScreen from '../../src/community/OutpostScreen';

export default function CommunityTab() {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <OutpostScreen />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
