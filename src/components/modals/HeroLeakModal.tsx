import React, { useState } from 'react';
import { HeroModelStore } from '../../bot/strategies/apex/model/HeroModelStore';
import { HeroLeakReporter, HeroLeakReport } from '../../bot/strategies/apex/telemetry/HeroLeakReporter';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, X, Zap } from 'lucide-react';

interface HeroLeakModalProps {
  onClose: () => void;
}

export const HeroLeakModal: React.FC<HeroLeakModalProps> = ({ onClose }) => {
  const [model, setModel] = useState(() => HeroModelStore.load());
  const report: HeroLeakReport = HeroLeakReporter.generateReport(model);

  const handleReset = () => {
    if (window.confirm('確定要清空 Apex Bot 對您的打法建模紀錄嗎？這將重置所有觀察樣本與剝削權重。')) {
      HeroModelStore.clear();
      const fresh = HeroModelStore.load();
      setModel(fresh);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden text-xs max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Hero 策略弱點診斷報告</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> Apex Exploitative Modeling
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                由 Apex Bot 透過長期決策觀察與貝氏推斷建立之 Hero 行為特徵與漏牌漏洞
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Summary Banner */}
          <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-slate-400 text-[11px]">已追蹤分析 Hero 手數</span>
              <strong className="text-lg font-bold text-slate-100">{report.handsTracked} 手</strong>
            </div>
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-slate-400 text-[11px]">整體漏洞評估</span>
              <span className="text-xs font-semibold text-amber-300">{report.overallAssessment}</span>
            </div>
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800 border border-slate-700 text-slate-300 text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
              title="清空 Hero 建模資料"
            >
              <RefreshCw className="w-3 h-3" />
              <span>重置建模數據</span>
            </button>
          </div>

          {/* Leaks List */}
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              <span>偵測到的打法漏洞 ({report.leaks.length})</span>
            </h3>

            {report.leaks.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 text-center flex flex-col items-center gap-2 text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <span className="font-semibold text-slate-200">未偵測到顯著之行為偏差</span>
                <span className="text-[11px] max-w-md">
                  您的打法目前與 GTO-Inspired 基準相當接近，或者對局樣本尚在累積中。持續進行對局，Apex Bot 將持續監測並診斷潛在漏洞。
                </span>
              </div>
            ) : (
              report.leaks.map((leak) => (
                <div
                  key={leak.id}
                  className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                    leak.severity === 'HIGH'
                      ? 'bg-rose-950/20 border-rose-800/70'
                      : leak.severity === 'MEDIUM'
                      ? 'bg-amber-950/20 border-amber-800/70'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          leak.severity === 'HIGH'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {leak.severity === 'HIGH' ? '高風險漏洞' : '中度漏洞'}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px] uppercase">
                        [{leak.category}]
                      </span>
                      <strong className="text-slate-100 text-xs font-bold">{leak.title}</strong>
                    </div>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed">{leak.description}</p>

                  <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Hero 觀察頻率：</span>
                      <strong className="text-rose-400 font-bold ml-1">{leak.observedRate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">理論基準頻率 (GTO Baseline)：</span>
                      <strong className="text-emerald-400 font-bold ml-1">{leak.gtoBaseline}</strong>
                    </div>
                  </div>

                  <div className="text-[11px] text-amber-200/90 flex items-start gap-1.5 bg-amber-950/30 p-2 rounded-lg border border-amber-900/40">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>修復建議：</strong>
                      {leak.recommendation}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 flex justify-end bg-slate-950/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
