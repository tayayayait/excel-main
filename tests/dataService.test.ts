import { aggregateData, cleanData } from '../services/dataService';
import { CleanedClaim, RawClaimData } from '../types';

const makeClaim = (id: string, date: string, phenomenon: string, severity: 'High' | 'Medium' | 'Low', cost: number): CleanedClaim => ({
  id,
  date,
  model: 'ModelX',
  description: `${phenomenon} issue`,
  partName: 'Part',
  cost,
  phenomenon,
  severity,
});

describe('Data aggregation helpers', () => {
  it('generates trend insight and cost spike alerts', () => {
    const claims: CleanedClaim[] = [
      makeClaim('A1', '2024-05-01', 'Seat Heater / Thermal', 'High', 120),
      makeClaim('A2', '2024-05-15', 'Seat Heater / Thermal', 'Medium', 80),
      makeClaim('B1', '2024-06-05', 'Power Seat / Motor', 'High', 200),
      makeClaim('B2', '2024-06-20', 'Power Seat / Motor', 'High', 220),
      makeClaim('C1', '2024-07-10', 'Track / Noise', 'Medium', 60),
      makeClaim('C2', '2024-07-25', 'Track / Noise', 'Low', 40),
      makeClaim('D1', '2024-08-05', 'Trim / Stitch / Tear', 'Low', 50),
      makeClaim('D2', '2024-08-18', 'Trim / Stitch / Tear', 'High', 90),
    ];

    const aggregated = aggregateData(claims);
    expect(aggregated.trendInsight).toBeDefined();
    expect(aggregated.trendInsight?.growthPercent).toBeGreaterThanOrEqual(-500);
    expect(aggregated.costSpike).toBeDefined();
    expect(aggregated.forecastTrend.length).toBeGreaterThanOrEqual(4);
    expect(aggregated.importantClaims.length).toBeGreaterThan(0);
  });
});

describe('cleanData', () => {
  it('preserves source IDs and generates unique normalized IDs', () => {
    const rawRows: RawClaimData[] = [
      {
        'Claim ID': ' QA001 ',
        'Incident Date': '2024-01-05',
        'Vehicle Model': 'ModelA',
        'Issue Description': 'Seat heater issue',
        'Part Name': 'Seat Heater',
        'Repair Cost': '250',
      },
      {
        'Claim ID': 'QA 001',
        'Incident Date': '2024-01-06',
        'Vehicle Model': 'ModelB',
        'Issue Description': 'Track noise',
        'Part Name': 'Seat Track',
        'Repair Cost': '0',
      },
      {
        'Incident Date': '2024-01-07',
        'Vehicle Model': 'ModelC',
        'Issue Description': 'Latch failure',
        'Part Name': 'Latch',
        'Repair Cost': '80',
      },
    ];

    const { claims: cleaned, stats } = cleanData(rawRows);
    expect(cleaned).toHaveLength(3);
    expect(stats.parsedRows).toBe(3);

    expect(cleaned[0].id).toBe('QA001');
    expect(cleaned[0].sourceId).toBe('QA001');

    expect(cleaned[1].id).toBe('QA001-2');
    expect(cleaned[1].sourceId).toBe('QA 001');

    expect(cleaned[2].id).toBe('CLM-3');
    expect(cleaned[2].sourceId).toBeUndefined();
  });

  it('retains Korean descriptions for classification and matching', () => {
    const rawRows: RawClaimData[] = [
      {
        'Claim ID': 'KOR-1',
        'Incident Date': '2024-02-01',
        'Vehicle Model': '모델A',
        'Issue Description': '  시트 히터 과열 및 화상 위험   ',
        'Part Name': '열선 어셈블리',
        'Repair Cost': '320',
      },
    ];

    const { claims: cleaned } = cleanData(rawRows);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].description).toBe('시트 히터 과열 및 화상 위험');
    expect(cleaned[0].partName).toBe('열선 어셈블리');
    expect(cleaned[0].phenomenon).toBe('Seat Heater / Thermal');
    expect(cleaned[0].flags).toContain('Safety Risk');
  });

  it('parses diverse cost formats with fallback flagging', () => {
    const rawRows: RawClaimData[] = [
      {
        'Claim ID': 'COST-1',
        'Incident Date': '2024-03-01',
        'Vehicle Model': 'ModelA',
        'Issue Description': 'Seat heater fault',
        'Part Name': 'Seat Heater',
        'Repair Cost': '1,200',
      },
      {
        'Claim ID': 'COST-2',
        'Incident Date': '2024-03-02',
        'Vehicle Model': 'ModelB',
        'Issue Description': 'Leather stain',
        'Part Name': 'Seat Cover',
        'Repair Cost': '₩1,200',
      },
      {
        'Claim ID': 'COST-3',
        'Incident Date': '2024-03-03',
        'Vehicle Model': 'ModelC',
        'Issue Description': 'Track squeak',
        'Part Name': 'Seat Track',
        'Repair Cost': '1 200',
      },
      {
        'Claim ID': 'COST-4',
        'Incident Date': '2024-03-04',
        'Vehicle Model': 'ModelD',
        'Issue Description': 'Latch stuck',
        'Part Name': 'Latch',
        'Repair Cost': '(1200)',
      },
      {
        'Claim ID': 'COST-5',
        'Incident Date': '2024-03-05',
        'Vehicle Model': 'ModelE',
        'Issue Description': 'Unknown cost input',
        'Part Name': 'Seat Base',
        'Repair Cost': '원 데이터 없음',
      },
    ];

    const { claims: cleaned, stats } = cleanData(rawRows);
    expect(cleaned.map(c => c.cost)).toEqual([1200, 1200, 1200, -1200, 0]);
    expect(cleaned.map(c => c.costParseFailed)).toEqual([false, false, false, false, true]);
    expect(stats.missingDate).toBe(0);
  });

  it('tracks dropped rows due to missing required columns', () => {
    const rawRows: RawClaimData[] = [
      {
        'Claim ID': 'MISS-1',
        'Issue Description': '내용 없음',
        'Repair Cost': '100',
      },
      {
        'Claim ID': 'MISS-2',
        'Incident Date': '2024-03-06',
        'Vehicle Model': '',
        'Issue Description': '',
      },
    ];

    const { claims, stats } = cleanData(rawRows);
    expect(claims).toHaveLength(1);
    expect(stats.droppedRows).toBe(1);
    expect(stats.missingDate).toBe(1);
    expect(stats.missingModel).toBeGreaterThan(0);
    expect(stats.missingDescription).toBeGreaterThan(0);
  });
});
