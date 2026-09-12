import dashboardStyles from "../dashboard.module.css";
import styles from "./leads.module.css";

const COLUMN_WIDTHS = ["70%", "80%", "60%", "75%", "50%", "65%"];

export default function LeadsLoading() {
  return (
    <div>
      <div className={dashboardStyles.pageHeading}>
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonTitle}`} />
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonSubtitle}`} />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Caller</th>
              <th>Phone</th>
              <th>Course</th>
              <th>Hostel</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {COLUMN_WIDTHS.map((width, colIndex) => (
                  <td key={colIndex}>
                    <div
                      className={`${dashboardStyles.skeleton} ${styles.skeletonCell}`}
                      style={{ width }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonPagerButton}`} />
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonPagerStatus}`} />
        <div className={`${dashboardStyles.skeleton} ${styles.skeletonPagerButton}`} />
      </div>
    </div>
  );
}
