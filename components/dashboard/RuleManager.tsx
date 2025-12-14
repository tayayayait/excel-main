import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download as DownloadIcon, RefreshCw, Upload } from 'lucide-react';
import { CleanedClaim, ClassificationRule, ClassificationRuleSet } from '../../types';
import { applyRulesToClaims } from '../../services/classificationService';
import { DEFAULT_CLASSIFICATION_RULES, CLASSIFICATION_RULES_VERSION } from '../../constants/classification';
import { downloadCSV } from '../../services/csvService';
import { parseRuleSetFromJson, serializeRuleSet } from '../../services/ruleService';

interface RuleManagerProps {
  claims: CleanedClaim[];
  ruleSet: ClassificationRuleSet;
  onApplyRuleSet: (ruleSet: ClassificationRuleSet) => void;
}

type DistributionKey = 'phenomenon' | 'cause' | 'contamination';

type PreviewResult = {
  claims: CleanedClaim[];
  baseline: Record<DistributionKey, Record<string, number>>;
  candidate: Record<DistributionKey, Record<string, number>>;
};

const cloneRuleSet = (rules: ClassificationRuleSet): ClassificationRuleSet =>
  JSON.parse(JSON.stringify(rules));

const joinList = (values?: string[]) => (values && values.length ? values.join(', ') : '');
const parseList = (value: string): string[] =>
  value
    .split(',')
    .map(token => token.trim())
    .filter(Boolean);

const downloadTextFile = (content: string, filename: string, mime = 'application/json') => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildDistribution = (claims: CleanedClaim[], key: DistributionKey) => {
  const counts: Record<string, number> = {};
  claims.forEach(claim => {
    let label = (claim as any)[key] as string | undefined;
    if (!label || label === 'Other / Unclassified') {
      label = 'Unclassified';
    }
    counts[label] = (counts[label] || 0) + 1;
  });
  return counts;
};

const RuleManager: React.FC<RuleManagerProps> = ({ claims, ruleSet, onApplyRuleSet }) => {
  const [draft, setDraft] = useState<ClassificationRuleSet>(() => cloneRuleSet(ruleSet));
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(cloneRuleSet(ruleSet));
  }, [ruleSet]);

  const resetDraftToCurrent = () => {
    setDraft(cloneRuleSet(ruleSet));
    setPreview(null);
  };

  const handleRuleChange = (
    category: 'phenomena' | 'causes' | 'contaminations',
    index: number,
    field: keyof ClassificationRule,
    value: string,
  ) => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      const target = next[category][index];
      if (field === 'keywords' || field === 'synonyms' || field === 'excludes') {
        (target as any)[field] = parseList(value);
      } else if (field === 'priority') {
        (target as any)[field] = Number(value) || 0;
      } else {
        (target as any)[field] = value;
      }
      return next;
    });
  };

  const handleRuleCodeChange = (category: 'phenomena' | 'causes' | 'contaminations', index: number, value: string) => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      next[category][index].code = value.replace(/\s+/g, '_').toLowerCase();
      return next;
    });
  };

  const handleAddRule = (category: 'phenomena' | 'causes' | 'contaminations') => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      next[category].splice(next[category].length - 1, 0, {
        code: `${category}_new_${Date.now()}`,
        label: 'New rule',
        keywords: [],
        priority: 10,
      });
      return next;
    });
  };

  const handleRemoveRule = (category: 'phenomena' | 'causes' | 'contaminations', index: number) => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      if (next[category].length <= 1) {
        return next;
      }
      next[category].splice(index, 1);
      return next;
    });
  };

  const handleSeverityChange = (index: number, field: 'keywords' | 'costThreshold', value: string) => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      if (field === 'keywords') {
        next.severity[index].keywords = parseList(value);
      } else {
        next.severity[index].costThreshold = value ? Number(value) : undefined;
      }
      return next;
    });
  };

  const handleFlagChange = (index: number, field: 'label' | 'keywords' | 'id', value: string) => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      if (field === 'keywords') {
        next.flags[index].keywords = parseList(value);
      } else if (field === 'id') {
        next.flags[index].id = value.replace(/\s+/g, '_').toLowerCase();
      } else {
        next.flags[index].label = value;
      }
      return next;
    });
  };

  const addFlag = () => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      next.flags.push({
        id: `flag_${Date.now()}`,
        label: 'New Flag',
        keywords: [],
      });
      return next;
    });
  };

  const removeFlag = (index: number) => {
    setDraft(prev => {
      const next = cloneRuleSet(prev);
      next.flags.splice(index, 1);
      return next;
    });
  };

  const duplicateWarnings = useMemo(() => {
    const warnings: string[] = [];
    const categories: { key: 'phenomena' | 'causes' | 'contaminations'; label: string }[] = [
      { key: 'phenomena', label: '현상' },
      { key: 'causes', label: '원인' },
      { key: 'contaminations', label: '오염' },
    ];

    categories.forEach(({ key, label }) => {
      const map = new Map<string, Set<string>>();
      draft[key].forEach(rule => {
        const tokens = new Set([
          ...rule.keywords.map(k => k.toLowerCase()),
          ...(rule.synonyms || []).map(s => s.toLowerCase()),
        ]);
        tokens.forEach(token => {
          if (!token) return;
          if (!map.has(token)) {
            map.set(token, new Set());
          }
          map.get(token)!.add(rule.label);
        });
      });
      const conflicts: string[] = [];
      map.forEach((owners, keyword) => {
        if (owners.size > 1) {
          conflicts.push(`${keyword} (${Array.from(owners).join(', ')})`);
        }
      });
      if (conflicts.length) {
        warnings.push(`[${label}] 중복 키워드: ${conflicts.slice(0, 5).join('; ')}`);
      }
    });
    return warnings;
  }, [draft]);

  const handlePreview = () => {
    if (!claims.length) {
      alert('미리보기할 데이터가 없습니다.');
      return;
    }
    const previewed = applyRulesToClaims(claims, draft);
    const baseline: PreviewResult['baseline'] = {
      phenomenon: buildDistribution(claims, 'phenomenon'),
      cause: buildDistribution(claims, 'cause'),
      contamination: buildDistribution(claims, 'contamination'),
    };
    const candidate: PreviewResult['candidate'] = {
      phenomenon: buildDistribution(previewed, 'phenomenon'),
      cause: buildDistribution(previewed, 'cause'),
      contamination: buildDistribution(previewed, 'contamination'),
    };
    setPreview({
      claims: previewed,
      baseline,
      candidate,
    });
  };

  const handleApply = () => {
    onApplyRuleSet(draft);
    setPreview(null);
  };

  const handleExport = () => {
    const json = serializeRuleSet(draft);
    downloadTextFile(json, `classification-rules-${draft.version || 'draft'}.json`);
  };

  const handleImport: React.ChangeEventHandler<HTMLInputElement> = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseRuleSetFromJson(text);
      setDraft(cloneRuleSet(parsed));
      setImportError(null);
    } catch (error) {
      setImportError('JSON 규칙 파일을 읽지 못했습니다.');
      console.error(error);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadUnclassified = (mode: 'current' | 'preview') => {
    const source = mode === 'preview' && preview ? preview.claims : claims;
    const unclassified = source.filter(
      claim => !claim.phenomenon || claim.phenomenon === 'Other / Unclassified' || claim.phenomenon === 'Unclassified',
    );
    if (!unclassified.length) {
      alert('미분류 항목이 없습니다.');
      return;
    }
    const content = [
      ['ID', 'Date', 'Model', 'Description', 'Phenomenon', 'Cause'].join(','),
      ...unclassified.map(claim =>
        [
          claim.id,
          claim.date,
          claim.model,
          `"${(claim.description || '').replace(/"/g, '""')}"`,
          claim.phenomenon || 'Unclassified',
          claim.cause || 'Unknown',
        ].join(','),
      ),
    ].join('\n');
    const suffix = mode === 'preview' ? 'preview' : 'current';
    downloadCSV(content, `unclassified-${suffix}.csv`);
  };

  const phenomenonDiff = useMemo(() => {
    if (!preview) return [];
    const labels = new Set([
      ...Object.keys(preview.baseline.phenomenon),
      ...Object.keys(preview.candidate.phenomenon),
    ]);
    return Array.from(labels.values())
      .map(label => {
        const base = preview.baseline.phenomenon[label] || 0;
        const next = preview.candidate.phenomenon[label] || 0;
        return {
          label,
          base,
          next,
          delta: next - base,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [preview]);

  const currentUnclassified =
    claims.filter(
      claim => !claim.phenomenon || claim.phenomenon === 'Other / Unclassified' || claim.phenomenon === 'Unclassified',
    ).length || 0;
  const previewUnclassified = preview
    ? preview.claims.filter(
        claim =>
          !claim.phenomenon || claim.phenomenon === 'Other / Unclassified' || claim.phenomenon === 'Unclassified',
      ).length
    : 0;

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900">분류 규칙 관리</h3>
          <p className="text-sm text-slate-500">
            기본 버전 {CLASSIFICATION_RULES_VERSION} / 현재 버전 {ruleSet.version}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="flex items-center px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            <DownloadIcon className="w-4 h-4 mr-2" />
            규칙 내보내기
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            규칙 가져오기
          </button>
          <button
            onClick={() => setDraft(cloneRuleSet(DEFAULT_CLASSIFICATION_RULES))}
            className="flex items-center px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            기본 규칙 불러오기
          </button>
          <button
            onClick={resetDraftToCurrent}
            className="flex items-center px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
          >
            변경 취소
          </button>
          <input
            type="file"
            accept="application/json"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1">버전</label>
          <input
            type="text"
            value={draft.version}
            onChange={e => setDraft(prev => ({ ...prev, version: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1">현재 미분류</label>
          <p className="text-lg font-semibold text-slate-800">{currentUnclassified} 건</p>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1">미리보기 미분류</label>
          <p className="text-lg font-semibold text-slate-800">
            {preview ? `${previewUnclassified} 건` : '-'}
          </p>
        </div>
      </div>

      {duplicateWarnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <div>
            <p className="font-semibold">중복 키워드 감지</p>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              {duplicateWarnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {importError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">{importError}</p>
      )}

      <section className="space-y-4">
        <h4 className="text-lg font-semibold text-slate-900">현상 / 원인 / 오염 규칙</h4>
        {(['phenomena', 'causes', 'contaminations'] as const).map(category => (
          <div key={category} className="border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="font-semibold text-slate-800">
                {category === 'phenomena' && '현상'}
                {category === 'causes' && '원인'}
                {category === 'contaminations' && '오염'}
              </p>
              <button
                onClick={() => handleAddRule(category)}
                className="text-sm px-3 py-1 border border-slate-300 rounded-md hover:bg-slate-100"
              >
                규칙 추가
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {draft[category].map((rule, index) => (
                <div key={rule.code} className="p-4 space-y-3">
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Label</label>
                      <input
                        value={rule.label}
                        onChange={e => handleRuleChange(category, index, 'label', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Code</label>
                      <input
                        value={rule.code}
                        onChange={e => handleRuleCodeChange(category, index, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Priority</label>
                      <input
                        type="number"
                        value={rule.priority || 0}
                        onChange={e => handleRuleChange(category, index, 'priority', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Keywords</label>
                      <textarea
                        value={joinList(rule.keywords)}
                        onChange={e => handleRuleChange(category, index, 'keywords', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Synonyms</label>
                      <textarea
                        value={joinList(rule.synonyms)}
                        onChange={e => handleRuleChange(category, index, 'synonyms', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Excludes</label>
                      <textarea
                        value={joinList(rule.excludes)}
                        onChange={e => handleRuleChange(category, index, 'excludes', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleRemoveRule(category, index)}
                      disabled={rule.code === 'other' || draft[category].length <= 1}
                      className="text-sm text-red-500 hover:text-red-600 disabled:text-slate-400"
                    >
                      규칙 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h4 className="text-lg font-semibold text-slate-900">심각도 / 플래그</h4>
        <div className="grid md:grid-cols-3 gap-3">
          {draft.severity.map((rule, index) => (
            <div key={rule.label} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-700">{rule.label}</p>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Keywords</label>
                <textarea
                  value={joinList(rule.keywords)}
                  onChange={e => handleSeverityChange(index, 'keywords', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Cost Threshold</label>
                <input
                  type="number"
                  value={rule.costThreshold ?? ''}
                  onChange={e => handleSeverityChange(index, 'costThreshold', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">플래그 규칙</p>
            <button
              onClick={addFlag}
              className="text-sm px-3 py-1 border border-slate-300 rounded-md hover:bg-slate-50"
            >
              플래그 추가
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {draft.flags.map((flag, index) => (
              <div key={flag.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">ID</label>
                  <input
                    value={flag.id}
                    onChange={e => handleFlagChange(index, 'id', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Label</label>
                  <input
                    value={flag.label}
                    onChange={e => handleFlagChange(index, 'label', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Keywords</label>
                  <textarea
                    value={joinList(flag.keywords)}
                    onChange={e => handleFlagChange(index, 'keywords', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    rows={2}
                  />
                </div>
                <div className="text-right">
                  <button
                    onClick={() => removeFlag(index)}
                    className="text-xs text-slate-500 hover:text-red-500"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handlePreview}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
          >
            규칙 변경 미리보기
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            규칙 저장 & 재분류
          </button>
          <button
            onClick={() => handleDownloadUnclassified('current')}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            미분류 샘플 다운로드(현재)
          </button>
          <button
            onClick={() => handleDownloadUnclassified('preview')}
            disabled={!preview}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            미분류 샘플 다운로드(미리보기)
          </button>
        </div>

        {preview && (
          <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
            <h5 className="text-sm font-semibold text-blue-900 mb-2">분류 분포 비교 (현상)</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-blue-700">
                    <th className="px-2 py-1">현상</th>
                    <th className="px-2 py-1">현재</th>
                    <th className="px-2 py-1">미리보기</th>
                    <th className="px-2 py-1">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {phenomenonDiff.slice(0, 10).map(row => (
                    <tr key={row.label} className="border-t border-blue-100">
                      <td className="px-2 py-1">{row.label}</td>
                      <td className="px-2 py-1">{row.base}</td>
                      <td className="px-2 py-1">{row.next}</td>
                      <td className={`px-2 py-1 ${row.delta >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {row.delta >= 0 ? '+' : ''}
                        {row.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default RuleManager;
