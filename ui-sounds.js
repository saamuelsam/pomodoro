const uiClickSounds = {
  primary: new Audio("assets/audio/button-press.mp3"),
  secondary: new Audio("assets/audio/button-click.mp3")
};

uiClickSounds.primary.preload = "auto";
uiClickSounds.secondary.preload = "auto";

function playUiClickSound(kind = "secondary") {
  const sound = uiClickSounds[kind];
  if (!sound) {
    return;
  }

  sound.currentTime = 0;
  const playAttempt = sound.play();
  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      // Ignore blocked playback before the browser fully unlocks audio.
    });
  }
}

function bindUiClickSounds() {
  const primarySelectors = [
    ".primary-button",
    ".nav-cta"
  ];
  const secondarySelectors = [
    ".secondary-button",
    ".ghost-button",
    ".mode-tab",
    ".nav-links a:not(.nav-cta)",
    ".footer-links a"
  ];

  document.querySelectorAll(primarySelectors.join(",")).forEach((element) => {
    element.addEventListener("click", () => playUiClickSound("primary"));
  });

  document.querySelectorAll(secondarySelectors.join(",")).forEach((element) => {
    element.addEventListener("click", () => playUiClickSound("secondary"));
  });
}

bindUiClickSounds();
