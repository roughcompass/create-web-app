import { Button } from "@salt-ds/core";
import { DarkIcon, LightIcon } from "@salt-ds/icons";
import { useAppTheme } from "./theme";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const { mode, setMode } = useAppTheme();
  const nextMode = mode === "light" ? "dark" : "light";
  return (
    <Button
      className={styles.button}
      appearance="transparent"
      sentiment="neutral"
      aria-label={`Switch to ${nextMode} theme`}
      title={`Switch to ${nextMode} theme`}
      onClick={() => { setMode(nextMode); }}
    >
      {mode === "light" ? <DarkIcon aria-hidden="true" /> : <LightIcon aria-hidden="true" />}
    </Button>
  );
}