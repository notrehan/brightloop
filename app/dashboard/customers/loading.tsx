import styles from "./customers.module.css";

export default function CustomersLoading() {
  return (
    <section className={`page ${styles.customersPage}`} aria-label="Loading customers" aria-busy="true">
      <div className={styles.loadingHeading}>
        <div className={styles.skeletonBlock} />
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonText} />
      </div>
      <div className={`panel ${styles.loadingForm}`}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonControls}><i /><i /><i /></div>
      </div>
      <div className={`panel ${styles.loadingList}`}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonControls}><i /><i /><i /></div>
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
        <div className={styles.skeletonRow} />
      </div>
      <span className={styles.visuallyHidden}>Loading customer records...</span>
    </section>
  );
}
