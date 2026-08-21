import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import OutpostScreen from '../../src/community/OutpostScreen';
import { PersistentTopNav } from '../../src/navigation/PersistentTopNav';

export default function CommunityTab() {
  return (
    <View style={styles.flex}>
      <PersistentTopNav />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <OutpostScreen />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
