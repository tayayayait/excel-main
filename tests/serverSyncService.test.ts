import { mergeClaimLists } from '../services/serverSyncService';
import { CleanedClaim } from '../types';

const claim = (id: string, date: string, updatedAt: string, model = 'ModelX'): CleanedClaim => ({
  id,
  date,
  updatedAt,
  model,
  description: 'desc',
});

describe('mergeClaimLists', () => {
  it('upserts incoming claims without shrinking the dataset', () => {
    const existing: CleanedClaim[] = [
      claim('A', '2024-01-01', '2024-01-02', 'ModelA'),
      claim('B', '2024-01-02', '2024-01-03', 'ModelB'),
    ];
    const incoming: CleanedClaim[] = [
      { ...claim('B', '2024-01-02', '2024-02-01', 'ModelB-Updated'), phenomenon: 'Updated' },
      claim('C', '2024-01-05', '2024-02-02', 'ModelC'),
    ];

    const merged = mergeClaimLists(existing, incoming);
    expect(merged).toHaveLength(3);
    const mergedIds = merged.map(c => c.id);
    expect(mergedIds).toContain('A');
    expect(mergedIds).toContain('B');
    expect(mergedIds).toContain('C');

    const updatedB = merged.find(c => c.id === 'B');
    expect(updatedB?.model).toBe('ModelB-Updated');
    expect(updatedB?.phenomenon).toBe('Updated');
  });
});
