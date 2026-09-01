import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web') {
  const originalAlert = Alert.alert.bind(Alert);

  Alert.alert = (title, message, buttons, options) => {
    if ((title === 'Profile photo' || title === 'Cover image') && Array.isArray(buttons)) {
      const changeAction = buttons.find((button) => /^change /i.test(button.text ?? ''));
      if (changeAction?.onPress) {
        changeAction.onPress();
        return;
      }
    }

    originalAlert(title, message, buttons, options);
  };
}
