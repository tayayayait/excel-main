import React from 'react';
import { ClassificationRuleSet, CleanedClaim } from '../../types';
import RuleManager from './RuleManager';

interface SettingsPanelProps {
  allClaims: CleanedClaim[];
  ruleSet: ClassificationRuleSet;
  onApplyRuleSet: (ruleSet: ClassificationRuleSet) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ allClaims, ruleSet, onApplyRuleSet }) => {
  return (
    <div className="space-y-6">
      <RuleManager claims={allClaims} ruleSet={ruleSet} onApplyRuleSet={onApplyRuleSet} />
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <h3 className="text-lg font-bold text-slate-900">운영 가이드</h3>
        <p className="text-sm text-slate-600">
          • API 토큰과 ChatGPT 키는 `.env.local`에 입력 후 재빌드해야 UI에 반영됩니다.
        </p>
        <p className="text-sm text-slate-600">
          • `docs/api-spec.md`에 따라 서버는 `updatedAt`을 기준으로 증분 데이터를 반환하므로, Excel 업로드 시
          원본 ID와 타임스탬프를 유지하세요.
        </p>
      </div>
    </div>
  );
};

export default SettingsPanel;
