import { StyleSheet, View } from 'react-native';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type Props = {
  title: string;
};

export function AppHeaderTitle({ title }: Props) {
  return (
    <View style={styles.container}>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    flexShrink: 1,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    flexShrink: 1,
  },
});
