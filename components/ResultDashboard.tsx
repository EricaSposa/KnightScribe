
import React, { useState } from 'react';
import { Submission, RubricCriterion } from '../types';
import { CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Download, Printer, FileEdit, CheckCircle2, LayoutDashboard, RotateCcw, ClipboardCheck, Info } from 'lucide-react';

interface Props {
  submissions: Submission[];
  rubric: RubricCriterion[];
  onRetry?: (id: string) => void;
  onBatchInsert?: () => void;
  onSingleInsert?: (id: string) => void;
  isInserting?: boolean;
}

const ResultDashboard: React.FC<Props> = ({ submissions, rubric, onRetry, onBatchInsert, onSingleInsert, isInserting }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const completed = submissions.filter(s => s.status === 'completed');
  const grading = submissions.filter(s => s.status === 'grading');
  const pending = submissions.filter(s => s.status === 'pending');
  const errors = submissions.filter(s => s.status === 'error');
  
  const eligibleForInsert = completed.filter(s => s.url && !s.feedbackInserted);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const downloadCSV = () => {
    const headers = ['Student Name', 'Total Score', 'Max Score', 'Feedback'];
    const rows = completed.map(s => [
      s.studentName,
      s.result?.totalScore,
      s.result?.maxPossibleScore,
      `"${s.result?.overallFeedback.replace(/"/g, '""')}"`
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "grading_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pending</p>
          <p className="text-2xl font-bold text-slate-700">{pending.length}</p>
        </div>
        <div className={`p-4 bg-white border rounded-xl shadow-sm text-center transition-all ${grading.length > 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200'}`}>
          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${grading.length > 0 ? 'text-indigo-600' : 'text-indigo-400'}`}>Grading</p>
          <div className="flex items-center justify-center gap-2">
            {grading.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 animate-ping bg-indigo-400 rounded-full opacity-20"></div>
                <Loader2 size={18} className="animate-spin text-indigo-500 relative z-10" />
              </div>
            )}
            <p className="text-2xl font-bold text-slate-700">{grading.length}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">Completed</p>
          <p className="text-2xl font-bold text-slate-700">{completed.length}</p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
          <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1">Errors</p>
          <p className="text-2xl font-bold text-slate-700">{errors.length}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h3 className="text-lg font-semibold text-slate-700">Grading Results</h3>
        <div className="flex flex-wrap gap-2">
          {eligibleForInsert.length > 0 && (
            <button 
              onClick={onBatchInsert}
              disabled={isInserting}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {isInserting ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
              Batch Insert ({eligibleForInsert.length})
            </button>
          )}
          {completed.length > 0 && (
            <>
              <button 
                onClick={downloadCSV}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-xs font-medium shadow-sm"
              >
                <Download size={14} /> Export CSV
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-xs font-medium shadow-sm"
              >
                <Printer size={14} /> Print
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {submissions.map((sub) => (
          <div 
            key={sub.id} 
            className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
              sub.status === 'grading' ? 'border-indigo-300 ring-2 ring-indigo-50 bg-indigo-50/5' : 
              sub.status === 'error' ? 'border-rose-200' : 'border-slate-200'
            }`}
          >
            <div 
              className={`p-4 flex items-center justify-between transition-colors ${
                (sub.status === 'completed' || sub.status === 'error') ? 'cursor-pointer hover:bg-slate-50' : ''
              }`}
              onClick={() => (sub.status === 'completed' || sub.status === 'error') && toggleExpand(sub.id)}
            >
              <div className="flex-1 flex items-center gap-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                  sub.status === 'grading' ? 'bg-indigo-100 animate-pulse ring-4 ring-indigo-50' : 
                  sub.status === 'error' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100'
                } text-slate-500`}>
                  {sub.status === 'pending' && <div className="w-2 h-2 bg-slate-400 rounded-full" />}
                  {sub.status === 'grading' && <Loader2 size={16} className="animate-spin text-indigo-600" />}
                  {sub.status === 'completed' && <CheckCircle size={18} className="text-emerald-500" />}
                  {sub.status === 'error' && <AlertCircle size={18} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold transition-colors ${
                      sub.status === 'grading' ? 'text-indigo-700' : 
                      sub.status === 'error' ? 'text-rose-700' : 'text-slate-700'
                    }`}>
                      {sub.studentName}
                    </h4>
                    {sub.feedbackInserted && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase rounded-full border border-emerald-100 animate-in fade-in zoom-in duration-500">
                        <CheckCircle2 size={10} /> Feedback Inserted
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs uppercase tracking-tight font-bold ${
                      sub.status === 'grading' ? 'text-indigo-400 animate-pulse' : 
                      sub.status === 'error' ? 'text-rose-400' : 'text-slate-400'
                    }`}>
                      {sub.status === 'grading' ? 'AI Analyzing...' : 
                       sub.status === 'error' ? 'Grading Failed' : sub.status}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                {sub.status === 'completed' && sub.result && (
                  <div className="text-right">
                    <span className="text-2xl font-bold text-slate-800">{sub.result.totalScore}</span>
                    <span className="text-sm text-slate-400 font-medium ml-1">/ {sub.result.maxPossibleScore}</span>
                  </div>
                )}
                {sub.status === 'grading' && (
                  <div className="flex items-center gap-2 text-indigo-500 font-medium text-xs">
                    <span className="hidden sm:inline">Thinking...</span>
                  </div>
                )}
                {sub.status === 'error' && onRetry && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRetry(sub.id);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 text-xs font-bold transition-all shadow-sm"
                    >
                      <RotateCcw size={14} /> Retry
                    </button>
                    <div className="text-slate-400">
                      {expandedId === sub.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                )}
                {sub.status === 'completed' && (
                  <div className="text-slate-400">
                    {expandedId === sub.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                )}
              </div>
            </div>

            {expandedId === sub.id && sub.status === 'error' && (
              <div className="p-4 border-t border-slate-100 bg-rose-50/20 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-rose-700 font-bold uppercase text-[10px] tracking-widest">
                  <Info size={14} /> Error Details
                </div>
                <div className="p-4 bg-white border border-rose-100 rounded-xl text-sm text-slate-600 shadow-sm leading-relaxed">
                  <p className="font-medium text-rose-600 mb-1">Grading interrupted:</p>
                  {sub.errorMsg || 'No specific error details provided by the AI system. Please check your internet connection or try again.'}
                </div>
                <div className="bg-white/50 p-3 rounded-lg text-[11px] text-slate-500 italic">
                  Tip: If using a link, ensure it is publicly accessible or has proper permissions.
                </div>
              </div>
            )}

            {expandedId === sub.id && sub.result && sub.status === 'completed' && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-400 uppercase">Overall Feedback</h5>
                  {sub.url && !sub.feedbackInserted && onSingleInsert && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSingleInsert(sub.id);
                      }}
                      disabled={isInserting}
                      className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
                    >
                      {isInserting ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <FileEdit size={14} className="text-indigo-500" />}
                      Insert into Google Doc
                    </button>
                  )}
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 leading-relaxed shadow-sm">
                  {sub.result.overallFeedback}
                </div>

                <div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Criterion Breakdown</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sub.result.criterionResults.map((res) => {
                      const criterion = rubric.find(c => c.id === res.criterionId);
                      return (
                        <div key={res.criterionId} className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-semibold text-slate-700 text-sm">{criterion?.name || 'Unknown Criterion'}</span>
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs font-bold">
                              {res.score} / {criterion?.maxPoints || '?'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 italic mb-2 leading-snug">
                            {criterion?.description}
                          </p>
                          <p className="text-sm text-slate-600 border-t border-slate-100 pt-2">
                            {res.feedback}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Original Submission</h5>
                  <div className="p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 h-32 overflow-y-auto whitespace-pre-wrap font-mono">
                    {sub.content}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {submissions.length === 0 && (
          <div className="py-20 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
            <LayoutDashboard size={48} className="text-slate-200 mx-auto mb-4" />
            <h4 className="font-semibold text-slate-600">No active grading sessions</h4>
            <p className="text-sm text-slate-400 mt-1">Start grading student work from the Submissions tab.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultDashboard;
