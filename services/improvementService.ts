import { CleanedClaim, ImprovementAction, ImprovementMetrics } from '../types';

const toISODate = (date: Date) => date.toISOString().split('T')[0];

const shiftDate = (isoDate: string, days: number) => {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) return isoDate;
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

const normalizePhenomenon = (value?: string) => value || 'Unclassified';

export const calculateImprovementMetrics = (
  claims: CleanedClaim[],
  actions: ImprovementAction[],
): Record<string, ImprovementMetrics> => {
  const metrics: Record<string, ImprovementMetrics> = {};
  actions.forEach(action => {
    if (!action.startDate) return;
    const windowDays =
      action.evaluationWindowDays && action.evaluationWindowDays > 0
        ? action.evaluationWindowDays
        : 30;
    const beforeStart = shiftDate(action.startDate, -windowDays);
    const afterEnd = shiftDate(action.startDate, windowDays);

    const relevantClaims = claims.filter(
      claim => normalizePhenomenon(claim.phenomenon) === normalizePhenomenon(action.phenomenon),
    );

    const beforeClaims = relevantClaims.filter(
      claim => claim.date >= beforeStart && claim.date < action.startDate,
    );
    const afterClaims = relevantClaims.filter(
      claim => claim.date >= action.startDate && claim.date <= afterEnd,
    );

    const beforeCost = beforeClaims.reduce((sum, claim) => sum + (claim.cost || 0), 0);
    const afterCost = afterClaims.reduce((sum, claim) => sum + (claim.cost || 0), 0);

    metrics[action.id] = {
      actionId: action.id,
      beforeCount: beforeClaims.length,
      afterCount: afterClaims.length,
      beforeCost,
      afterCost,
      deltaCount: afterClaims.length - beforeClaims.length,
      deltaCost: afterCost - beforeCost,
    };
  });
  return metrics;
};
