import styles from "./portal.module.css";

export default function PortalLoading() {
  return (
    <main className={styles.portalPage} aria-busy="true" aria-label="Loading customer portal">
      <header className={styles.portalHeader}>
        <div className={styles.brand}><span className={styles.brandMark}>b</span><span>brightloop</span></div>
        <span className={styles.skeleton} />
      </header>
      <div className={styles.content}>
        <div className={styles.skeletonHeading} />
        {[1, 2, 3].map((item) => (
          <div className={styles.loadingPanel} key={item}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonLine} />
            <div className={styles.skeletonLineShort} />
          </div>
        ))}
      </div>
    </main>
  );
}
