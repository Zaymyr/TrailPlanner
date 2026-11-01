import { View } from 'react-native';
import { Text } from '../themed/Text';
import type { GaugeMetric } from './GaugeArc';
import type { PlanTarget, SectionSummary, SectionTarget } from './contracts';
import { getGaugeTolerance } from './metrics';
import { styles } from './styles';

type CoverageSeverity = 'ok' | 'warning' | 'danger';

type Props = {
  target: PlanTarget;
  summary: SectionSummary | null;
  compact?: boolean;
  getGaugeMetrics: (target: PlanTarget, sectionTarget?: SectionTarget) => GaugeMetric[];
  prepared?: boolean;
};

function formatSectionTarget(summary: SectionSummary | null): SectionTarget {
  return {
    targetCarbsG: summary?.targetCarbsG ?? 0,
    targetSodiumMg: summary?.targetSodiumMg ?? 0,
    targetWaterMl: summary?.targetWaterMl ?? 0,
  };
}

function formatCoveragePair(metric: GaugeMetric) {
  if (metric.key === 'water') {
    const currentMl = Math.round(metric.current / 100) * 100;
    const targetMl = Math.round(metric.target / 100) * 100;
    return `${currentMl} / ${targetMl} ml eau`;
  }

  return `${Math.round(metric.current)} / ${Math.round(metric.target)} ${metric.unit} ${metric.label.toLowerCase()}`;
}

function summarizeCoverage(metrics: GaugeMetric[]) {
  const chips = metrics.map(formatCoveragePair);
  const deficits = metrics
    .map((metric) => ({
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      ratio: metric.statusRatio ?? metric.ratio,
      missing: Math.max(0, metric.target - metric.current),
      tolerance: getGaugeTolerance(metric.key, metric.target),
    }))
    .filter((metric) => metric.missing > metric.tolerance);

  const severity: CoverageSeverity = deficits.some((metric) => metric.ratio < 0.82)
    ? 'danger'
    : deficits.some((metric) => metric.ratio < 1)
      ? 'warning'
      : 'ok';
  const title =
    severity === 'ok'
      ? 'Couvert jusqu’au prochain point utile'
      : severity === 'warning'
        ? 'Un peu juste pour tenir la suite'
        : 'Risque de manque avant recharge';
  const shortLabel = severity === 'ok' ? 'OK' : severity === 'warning' ? 'A ajuster' : 'Insuffisant';

  if (deficits.length === 0) {
    return {
      severity,
      title,
      shortLabel,
      detail: 'Ce que tu emportes ici suffit jusqu’au prochain point où tu peux recharger cette ressource.',
      action: 'Tu peux repartir comme ça.',
      chips,
    };
  }

  const topDeficit = [...deficits].sort((a, b) => b.missing - a.missing)[0];
  const deficitChips = deficits.slice(0, 2).map((metric) =>
    metric.key === 'water'
      ? `${Math.round(metric.missing / 100) * 100} ml manquants`
      : `${Math.round(metric.missing)} ${metric.unit} ${metric.label.toLowerCase()} manquants`,
  );

  let action = 'Ajoute un peu de ravitaillement avant de repartir.';
  if (topDeficit.key === 'carbs') {
    action =
      topDeficit.missing <= 30
        ? 'Ajoute 1 prise sucrée de plus pour éviter le déficit.'
        : 'Ajoute au moins 2 prises glucides avant de repartir.';
  } else if (topDeficit.key === 'water') {
    action =
      topDeficit.missing <= 300
        ? 'Ajoute un petit complément d’eau avant de repartir.'
        : 'Remplis au moins 500 ml de plus avant de repartir.';
  } else if (topDeficit.key === 'sodium') {
    action =
      topDeficit.missing <= 250
        ? 'Ajoute un peu de sodium pour sécuriser ce segment.'
        : 'Ajoute une source de sodium en plus avant de repartir.';
  }

  const detail =
    topDeficit.key === 'water'
      ? `Il manque environ ${Math.round(topDeficit.missing / 100) * 100} ml pour tenir jusqu’au prochain point d’eau.`
      : `Il manque environ ${Math.round(topDeficit.missing)} ${topDeficit.unit} de ${topDeficit.label.toLowerCase()} pour tenir jusqu’au prochain point solide.`;

  return { severity, title, shortLabel, detail, action, chips: [...chips, ...deficitChips] };
}

export function AidStationCoveragePanel({ target, summary, compact = false, getGaugeMetrics, prepared = true }: Props) {
  if (!prepared) {
    if (compact) {
      return <View style={styles.coverageCompactRow}>
        <View style={styles.coveragePill}><Text style={styles.coveragePillText}>À préparer</Text></View>
        <Text style={styles.coverageCompactTitle}>Répartis tes produits automatiquement</Text>
      </View>;
    }
    return <View style={styles.coveragePanel}>
      <View style={styles.coveragePanelHeader}>
        <View style={styles.coveragePill}><Text style={styles.coveragePillText}>À préparer</Text></View>
        <Text style={styles.coveragePanelTitle}>Prépare ta nutrition de course</Text>
      </View>
      <Text style={styles.coveragePanelDetail}>Répartis tes produits automatiquement pour vérifier tes besoins en glucides, eau et sodium.</Text>
    </View>;
  }
  const coverage = summarizeCoverage(getGaugeMetrics(target, formatSectionTarget(summary)));
  const toneStyle =
    coverage.severity === 'ok'
      ? styles.coveragePanelOk
      : coverage.severity === 'warning'
        ? styles.coveragePanelWarning
        : styles.coveragePanelDanger;
  const pillStyle =
    coverage.severity === 'ok'
      ? styles.coveragePillOk
      : coverage.severity === 'warning'
        ? styles.coveragePillWarning
        : styles.coveragePillDanger;
  const pillTextStyle =
    coverage.severity === 'ok'
      ? styles.coveragePillTextOk
      : coverage.severity === 'warning'
        ? styles.coveragePillTextWarning
        : styles.coveragePillTextDanger;

  if (compact) {
    return (
      <View style={[styles.coverageCompactRow, toneStyle]}>
        <View style={[styles.coveragePill, pillStyle]}>
          <Text style={[styles.coveragePillText, pillTextStyle]}>{coverage.shortLabel}</Text>
        </View>
        <Text style={styles.coverageCompactTitle} numberOfLines={1}>
          {coverage.title}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.coveragePanel, toneStyle]}>
      <View style={styles.coveragePanelHeader}>
        <View style={[styles.coveragePill, pillStyle]}>
          <Text style={[styles.coveragePillText, pillTextStyle]}>{coverage.shortLabel}</Text>
        </View>
        <Text style={styles.coveragePanelTitle}>{coverage.title}</Text>
      </View>
      <Text style={styles.coveragePanelDetail}>{coverage.detail}</Text>
      <Text style={styles.coveragePanelAction}>{coverage.action}</Text>
      <View style={styles.coverageChipRow}>
        {coverage.chips.map((chip) => (
          <View key={chip} style={styles.coverageChip}>
            <Text style={styles.coverageChipText}>{chip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
