import 'react-native';

declare module 'react-native' {
  interface StyleSheetStatic {
    absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
    };
  }
}
