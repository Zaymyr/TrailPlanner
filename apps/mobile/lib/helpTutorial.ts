export type HelpTutorialScreenKey = 'profile';

export type SpotlightPlacement = 'auto' | 'top' | 'bottom';

export type TutorialStep<TTargetKey extends string = string> = {
  screenKey: HelpTutorialScreenKey;
  targetKey: TTargetKey;
  title: string;
  body: string;
  highlightPadding?: number;
  highlightRadius?: number;
  placement?: SpotlightPlacement;
};

export type SpotlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HelpTutorialRequest = {
  screenKey: HelpTutorialScreenKey;
};

const helpTutorialListeners = new Set<(request: HelpTutorialRequest) => void>();

export function emitHelpTutorialRequest(screenKey: HelpTutorialScreenKey) {
  for (const listener of helpTutorialListeners) {
    listener({ screenKey });
  }
}

export function addHelpTutorialRequestListener(listener: (request: HelpTutorialRequest) => void) {
  helpTutorialListeners.add(listener);

  return () => {
    helpTutorialListeners.delete(listener);
  };
}
