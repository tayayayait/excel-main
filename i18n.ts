export const translateSeverity = (value?: string | null): string => {
  const map: Record<string, string> = {
    High: '높음',
    Medium: '보통',
    Low: '낮음',
  };
  if (!value) {
    return '낮음';
  }
  return map[value] || value;
};

export const translatePhenomenon = (value?: string | null): string => {
  if (!value || value === 'Unclassified') {
    return '미분류';
  }
  return value;
};

export const translateServerStatusLabel = (status: 'idle' | 'syncing' | 'error'): string => {
  switch (status) {
    case 'syncing':
      return '동기화 중';
    case 'error':
      return '오류';
    default:
      return '연결됨';
  }
};
