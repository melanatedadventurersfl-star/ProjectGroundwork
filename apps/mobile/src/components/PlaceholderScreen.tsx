import { StyleSheet, Text, View } from 'react-native';

type PlaceholderScreenProps = {
  title: string;
  description: string;
};

export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F3EA',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#17211B',
    fontSize: 28,
    fontWeight: '800',
  },
  description: {
    color: '#56615A',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
  },
});
