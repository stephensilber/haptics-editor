import styles from "./styles.module.scss";

import { Demo } from "./demo";
import { useApp } from "../../context/app";
import { SoundIcon } from "./sound-icon";
import { Logo } from "../../components/logo";

export default function MobileView() {
  const { debug, setDebug } = useApp();

  return (
    <div className={styles.page}>
      <div className={styles.debug}>
        <button
          onClick={() => {
            setDebug(!debug);
          }}
        >
          <SoundIcon enabled={debug} />
        </button>
      </div>
      <div className={styles.container}>
        <div className={styles.header}>
          <Logo />

          <p>Haptic feedback for the mobile web</p>
        </div>

        <Demo />
      </div>
    </div>
  );
}
