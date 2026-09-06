import React from 'react';
import { ShieldCheck, X, AlertTriangle, Lock, EyeOff, Server, Database, Key } from 'lucide-react';
import { ThreatZoneReview } from '../types';

interface ThreatModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const threatZones: ThreatZoneReview[] = [
  {
    zone: '1. Input Surfaces',
    threat: 'Malicious payload injection, buffer overrun, untrusted prompt submissions & unvalidated audio transcriptions.',
    countermeasure: 'Strict 15,000 character length limits, null-safe request destructuring, and typed schema validation before ingestion.',
    status: 'enforced',
  },
  {
    zone: '2. Planning & Reasoning',
    threat: 'Indirect prompt injection in user reflection content attempting to override Gemini system instructions.',
    countermeasure: 'Strict input containment within <user_reflection> delimiter tags; system prompts enforce analytical boundaries.',
    status: 'enforced',
  },
  {
    zone: '3. Tool & API Execution',
    threat: 'Gemini API quota exhaustion, DoS, upstream 503/429 outages, and key compromise.',
    countermeasure: 'Per-user sliding window rate limiting (40 req/min), 4-tier model fallback ladder, and server-side secret isolation.',
    status: 'enforced',
  },
  {
    zone: '4. Memory & State',
    threat: 'Cross-user journal snooping, unauthorized document reads, and database write crashes from undefined fields.',
    countermeasure: 'Owner-bound Firestore Security Rules (request.auth.uid == userId), strict undefined stripping, and user-triggered data purge.',
    status: 'enforced',
  },
  {
    zone: '5. Inter-System & Telemetry',
    threat: 'Sensitive journal leaks in server logs, browser history token exposure, and CORS wildcard breaches.',
    countermeasure: 'Bearer header JWT authentication, strict telemetry logging (zero raw journal or prompt data logged), and client-side audio processing.',
    status: 'enforced',
  },
];

export const ThreatModelModal: React.FC<ThreatModelModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        id="threat-model-modal"
        className="bg-[#0F0F0F] border border-zinc-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-zinc-100"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 bg-[#0A0A0A] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-800 border border-zinc-700 text-emerald-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">Agentic Threat Model &amp; Security Controls</h2>
              <p className="text-xs text-zinc-400">Rigorous 5-Zone threat analysis and OWASP LLM security countermeasures</p>
            </div>
          </div>
          <button
            id="close-threat-model-btn"
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-300">Zero-Knowledge Journal Privacy:</strong> Your personal reflections, mood states, and entries are strictly isolated to your authenticated account UID. Server logs never store journal text or prompts.
            </p>
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-300 font-semibold border-b border-zinc-800 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-1/4">Threat Zone</th>
                  <th className="py-3 px-4 w-1/3">Identified Risk</th>
                  <th className="py-3 px-4">Countermeasure &amp; Mitigation</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-[#0F0F0F]">
                {threatZones.map((item, index) => (
                  <tr key={index} className="hover:bg-zinc-900/60 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-zinc-200 flex items-center gap-2">
                      {index === 0 && <Lock className="w-4 h-4 text-zinc-500" />}
                      {index === 1 && <EyeOff className="w-4 h-4 text-zinc-500" />}
                      {index === 2 && <Server className="w-4 h-4 text-zinc-500" />}
                      {index === 3 && <Database className="w-4 h-4 text-zinc-500" />}
                      {index === 4 && <Key className="w-4 h-4 text-zinc-500" />}
                      <span className="text-xs">{item.zone}</span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 text-xs leading-relaxed">{item.threat}</td>
                    <td className="py-3.5 px-4 text-zinc-300 text-xs leading-relaxed font-mono bg-zinc-950/50">{item.countermeasure}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-[#0A0A0A] border border-zinc-800 rounded-2xl">
              <div className="text-xs font-semibold text-zinc-200 mb-1 uppercase tracking-wider">Model Fallback Ladder</div>
              <div className="text-[11px] text-zinc-400 font-mono">gemini-3.8-flash → gemini-3.1-flash-lite → dynamic alias → gemini-3.7-flash</div>
            </div>
            <div className="p-3.5 bg-[#0A0A0A] border border-zinc-800 rounded-2xl">
              <div className="text-xs font-semibold text-zinc-200 mb-1 uppercase tracking-wider">Firestore Isolation</div>
              <div className="text-[11px] text-zinc-400 font-mono">/users/$&#123;uid&#125;/* strictly enforced via security rules</div>
            </div>
            <div className="p-3.5 bg-[#0A0A0A] border border-zinc-800 rounded-2xl">
              <div className="text-xs font-semibold text-zinc-200 mb-1 uppercase tracking-wider">Rate Limiting</div>
              <div className="text-[11px] text-zinc-400 font-mono">40 req/min sliding window per user token / IP</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-[#0A0A0A] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold uppercase tracking-widest bg-zinc-100 text-black rounded-xl hover:bg-white transition-colors"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
