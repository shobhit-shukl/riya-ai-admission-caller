import dashboardStyles from "../dashboard.module.css";
import styles from "./analytics.module.css";

export default function AnalyticsLoading() {
  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonTitle}`} />
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonSubtitle}`} />
      </div>

      <div className={styles.statGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={dashboardStyles.skeletonCard} key={index}>
            <div className={styles.skeletonStatRow}>
              <div className={`${dashboardStyles.skeleton} ${styles.skeletonIcon}`} />
              <div className={styles.skeletonStatText}>
                <div className={`${dashboardStyles.skeleton} ${styles.skeletonLabel}`} />
                <div className={`${dashboardStyles.skeleton} ${styles.skeletonValue}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.panelGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div className={dashboardStyles.skeletonCard} key={index}>
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonPanelHeading}`} />
            <div className={styles.skeletonBarList}>
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <div
                  className={`${dashboardStyles.skeleton} ${styles.skeletonBarRow}`}
                  key={rowIndex}
                  style={{ width: `${90 - rowIndex * 14}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={dashboardStyles.skeletonCard}>
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonPanelHeading}`} />
        {Array.from({ length: 3 }).map((_, index) => (
          <div className={`${dashboardStyles.skeleton} ${styles.skeletonRecentRow}`} key={index} />
        ))}
      </div>
    </div>
  );
}
