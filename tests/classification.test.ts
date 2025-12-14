import { classifyClaim } from '../services/classificationService';

describe('Classification Service', () => {
  it('should recognize synonyms from the taxonomy', () => {
    const result = classifyClaim('전동시트 모터가 멈추고 리클라이너가 작동하지 않음', 'Seat Motor', 150);
    expect(result.phenomenon).toBe('Power Seat / Motor');
    expect(result.cause).toBe('Actuator / Motor');
    expect(result.severity).toBe('Medium');
  });

  it('should assign safety flags for burn keywords', () => {
    const result = classifyClaim('Seat heater burns user and smells like fire', 'Seat Heater', 500);
    expect(result.severity).toBe('High');
    expect(result.flags).toContain('Safety Risk');
  });
});
