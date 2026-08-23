import 'react-native';

declare module 'react-native' {
  namespace StyleSheet {
    /** Legacy runtime alias used by existing screens. */
    const absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
  }
}
