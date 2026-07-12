/**
 * LandWaterSection — irrigation & crop water need from Open-Meteo ET₀
 */

import {
  LAND_DETAIL_SOURCES,
  buildSoilMoistureIndex,
  resolveWaterRecord,
} from "./landDetailUtils";

function WaterCard({ record, land, soilByDate }) {
  const data = resolveWaterRecord(record, land, soilByDate);
  const dateLabel = new Date(record.timestamp).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card land-detail-water-card">
      <div className="land-detail-water-card__top">
        <div className="text-overline">{dateLabel}</div>
        <span className={`badge badge--${data.statusBadge}`}>{data.statusLabel}</span>
      </div>

      <div className="land-detail-water-card__hero">
        <span className="land-detail-water-card__icon" aria-hidden>
          💧
        </span>
        <div>
          <div className="land-detail-water-card__metric-value">
            {data.et0Formatted ?? "—"}
          </div>
          <div className="text-caption">Daily crop water need (ET₀)</div>
        </div>
      </div>

      <div className="land-detail-water-card__stats">
        <div className="land-detail-water-card__stat">
          <span className="land-detail-water-card__stat-label">Est. volume</span>
          <span className="land-detail-water-card__stat-value">
            {data.waterFormatted ?? "—"}
            {data.derivedVolume && (
              <span className="land-detail-water-card__hint" title="Computed from ET₀ × land area">
                calc
              </span>
            )}
          </span>
        </div>
        {data.soilMoisture != null && (
          <div className="land-detail-water-card__stat">
            <span className="land-detail-water-card__stat-label">Soil moisture</span>
            <span className="land-detail-water-card__stat-value">{data.soilMoisture.toFixed(0)}%</span>
          </div>
        )}
        {data.efficiency && (
          <div className="land-detail-water-card__stat">
            <span className="land-detail-water-card__stat-label">Efficiency</span>
            <span className="land-detail-water-card__stat-value">{data.efficiency}</span>
          </div>
        )}
      </div>

      {data.soilMoisture != null && (
        <div className="land-detail-water-card__bar-wrap">
          <div className="land-detail-soil-card__bar">
            <div
              style={{
                width: `${Math.min(data.soilMoisture, 100)}%`,
                background:
                  data.status === "overdue"
                    ? "var(--error)"
                    : data.status === "needed_soon"
                      ? "var(--warning)"
                      : "var(--info)",
              }}
            />
          </div>
        </div>
      )}

      {(data.derivedStatus || data.derivedVolume) && (
        <p className="land-detail-water-card__footnote text-caption">
          Derived from Open-Meteo weather &amp; soil data
        </p>
      )}
    </div>
  );
}

export default function LandWaterSection({
  water,
  visibleWater,
  land,
  soil,
  avgWaterEt0,
  latestWaterStatus,
  showAllWater,
  setShowAllWater,
  timeRangeSummaryText,
}) {
  if (!water || water.length === 0) {
    return (
      <div className="land-detail__section anim-stagger" style={{ "--stagger-index": 7 }}>
        <div className="section-header land-section-header--mobile">
          <h2 className="section-header__title">Irrigation &amp; Water Usage</h2>
        </div>
        <div className="card land-detail__empty-card">
          <p className="text-body-sm">
            {timeRangeSummaryText
              ? `No water records in the selected period. Try a wider range.`
              : "No water data tracked for this land."}
          </p>
        </div>
      </div>
    );
  }

  const soilByDate = buildSoilMoistureIndex(soil);
  const areaLabel =
    land?.area_hectares != null ? `${Number(land.area_hectares).toFixed(2)} ha` : null;

  return (
    <div className="anim-stagger land-detail__section" style={{ "--stagger-index": 7 }}>
      <div className="section-header land-section-header--mobile">
        <h2 className="section-header__title">Irrigation &amp; Water Usage</h2>
        <div className="land-detail__badge-row">
          {avgWaterEt0 !== "—" && (
            <span className="badge badge--info">Avg ET₀: {avgWaterEt0} mm/day</span>
          )}
          {latestWaterStatus && (
            <span className={`badge badge--${latestWaterStatus.badge}`}>
              {latestWaterStatus.label}
            </span>
          )}
          <span className="badge badge--neutral">{water.length} days</span>
        </div>
      </div>

      {areaLabel && (
        <p className="land-detail-water-intro text-body-sm">
          Daily crop water need is based on reference evapotranspiration (ET₀) for this{" "}
          {areaLabel} field. Volumes are estimated from ET₀ × area — not metered irrigation use.
        </p>
      )}

      <div className="land-detail-water-grid">
        {visibleWater.map((w, i) => (
          <WaterCard key={w.timestamp || i} record={w} land={land} soilByDate={soilByDate} />
        ))}
      </div>

      {water.length > 6 && (
        <div className="land-detail__show-more">
          <button className="btn btn--ghost" onClick={() => setShowAllWater(!showAllWater)}>
            {showAllWater ? "Show Less" : `Show All (${water.length})`}
          </button>
        </div>
      )}

      <p className="land-detail-section-footer text-caption">
        {LAND_DETAIL_SOURCES.water} · ~2 day archive lag
        {water.length > 0 &&
          ` · data through ${new Date(water[water.length - 1].timestamp).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`}
      </p>
    </div>
  );
}