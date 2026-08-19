import 'react-native';

declare module 'react-native' {
  interface StyleSheetProperties {
    absoluteFillObject: {
      position: 'absolute';
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
    };
  }
}
