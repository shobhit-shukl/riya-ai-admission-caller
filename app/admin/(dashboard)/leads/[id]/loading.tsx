import dashboardStyles from "../../dashboard.module.css";
import styles from "../leads.module.css";

export default function LeadDetailLoading() {
  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonBackLink}`} />
      </div>

      <div className={styles.standaloneDetail}>
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <div>
              <div className={`${dashboardStyles.skeleton} ${styles.skeletonName}`} />
              <div className={`${dashboardStyles.skeleton} ${styles.skeletonSubtitleSmall}`} />
            </div>
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonTimestamp}`} />
          </div>

          <div className={styles.detailGrid}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div className={styles.field} key={index}>
                <div className={`${dashboardStyles.skeleton} ${styles.skeletonFieldLabel}`} />
                <div className={`${dashboardStyles.skeleton} ${styles.skeletonFieldValue}`} />
              </div>
            ))}
          </div>

          <div className={styles.detailSection}>
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonFieldLabel}`} />
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonSummaryLine}`} />
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonSummaryLineShort}`} />
          </div>

          <div className={styles.detailSection}>
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonFieldLabel}`} />
            <div className={`${dashboardStyles.skeleton} ${styles.skeletonTranscript}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
