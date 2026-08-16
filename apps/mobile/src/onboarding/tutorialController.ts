type TutorialListener = () => void;

const listeners = new Set<TutorialListener>();

export function startGuidedTutorial() {
  listeners.forEach((listener) => listener());
}

export function subscribeGuidedTutorial(listener: TutorialListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
