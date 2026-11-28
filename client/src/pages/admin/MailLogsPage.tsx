import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminSidebar from '../../components/layout/AdminSidebar';
import AnimatedPage from '../../components/AnimatedPage';
import ParticleField from '../../components/3d/ParticleField';
import {
  IconMail,
  IconRefresh,
  IconCheck,
  IconCross,
  IconEye,
  IconShield,
  IconPlus,
  IconFlash,
  IconTrash,
} from '../../components/icons/HumanIcons';

import {
  listMailLogs,
  resendMailLog,
  forwardMailLog,
  listMailForwarders,
  saveMailForwarder,
  deleteMailForwarder,
  listMailTemplates,
  previewMailTemplate,
  dispatchAdminEmail,
  listRecentMailRecipients,
  listMailDrafts,
  saveMailDraft,
  sendMailDraft,
  deleteMailDraft,
  getMailStats,
  listColleges,
  type MailLog,
  type MailForwarderRule,
  type MailTemplateDefinition,
  type MailDraftRecord,
  type RecentMailRecipient,
  extractErrorMessage,
} from '../../lib/api';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/config';
import {
  COURSE_OPTIONS,
  getBranchesForCourse,
  inferCourseFromBranch,
  buildSectionChoices,
} from '../../constants/academicCatalog';

const FALLBACK_TEMPLATE_OPTIONS = [
  { value: 'password_reset', label: 'password_reset — Password Reset Link' },
  { value: 'user_id_recovery', label: 'user_id_recovery — User ID & Hall Ticket Recovery' },
  { value: 'admin_welcome', label: 'admin_welcome — Admin Console Onboarding' },
  { value: 'inspector_created', label: 'inspector_created — Invigilator Onboarding' },
  { value: 'faculty_created', label: 'faculty_created — Faculty & Assigned Sections' },
  { value: 'welcome_credentials', label: 'welcome_credentials — Credentials Welcome' },
  { value: 'student_otp', label: 'student_otp — Student Verification OTP' },
  { value: 'admin_login_otp', label: 'admin_login_otp — Staff Login Security OTP' },
  { value: 'student_registered', label: 'student_registered — Registration Confirmed' },
  { value: 'exam_scheduled', label: 'exam_scheduled — Examination Hall Ticket' },
  { value: 'exam_started_reminder', label: 'exam_started_reminder — Live Exam Reminder' },
  { value: 'submission_receipt', label: 'submission_receipt — Digital Submission Receipt' },
  { value: 'result_report', label: 'result_report — Official Result Scorecard' },
  { value: 'faculty_paper_allocated', label: 'faculty_paper_allocated — Paper Allocation' },
  { value: 'inspector_notice', label: 'inspector_notice — Proctor Warning Notice' },
  { value: 'inspector_issue_alert', label: 'inspector_issue_alert — Telemetry Flag Alert' },
  { value: 'termination_alert', label: 'termination_alert — Session Termination Alert' },
  { value: 'batch_termination_summary', label: 'batch_termination_summary — Termination Digest' },
  { value: 'admin_alert', label: 'admin_alert — Admin Incident Alert' },
  { value: 'admin_system_alert', label: 'admin_system_alert — System Health Bulletin' },
  { value: 'daily_backup_completed', label: 'daily_backup_completed — Nightly Backup Report' },
  { value: 'contact_auto_reply', label: 'contact_auto_reply — Contact Auto-Reply' },
  { value: 'contact_admin_notification', label: 'contact_admin_notification — Contact Admin Alert' },
  { value: 'mail_forwarded', label: 'mail_forwarded — Forwarded & Relay Copies' },
  { value: 'custom_broadcast', label: 'custom_broadcast — Institutional Broadcast' },
];

export default function MailLogsPage() {
  const [logs, setLogs] = useState<MailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<MailLog | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTemplate, setFilterTemplate] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0 });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Direct Dispatch Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeSubject, setComposeSubject] = useState('LogicWhile Assessment Update');
  const [composeTemplate, setComposeTemplate] = useState('custom_broadcast');
  const [composeBody, setComposeBody] = useState('<p>Dear Candidate,</p><p>This is an official assessment notification regarding your upcoming examination session on LogicWhile LiRE.</p><p>Please log in with your hall ticket to ensure your clearance.</p>');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Manual Forward Modal State
  const [forwardModalLog, setForwardModalLog] = useState<MailLog | null>(null);
  const [forwardTarget, setForwardTarget] = useState('');
  const [forwardNote, setForwardNote] = useState('');
  const [forwardingEmail, setForwardingEmail] = useState(false);

  // Mail Forwarder Rules & Live Relay Telemetry
  const [forwarders, setForwarders] = useState<MailForwarderRule[]>([]);
  const [showForwardersPanel, setShowForwardersPanel] = useState(true);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTemplate, setNewRuleTemplate] = useState('password_reset');
  const [newRuleEmail, setNewRuleEmail] = useState('');
  const [newRuleMode, setNewRuleMode] = useState<'forward_copy' | 'bcc'>('forward_copy');
  const [savingRule, setSavingRule] = useState(false);
  const [mailRelayStats, setMailRelayStats] = useState<{
    sentCount: number;
    dailyCap: number;
    pending: number;
    processing: number;
  }>({ sentCount: 0, dailyCap: 100, pending: 0, processing: 0 });
  const [dispatchPulse, setDispatchPulse] = useState(false);

  // Cohort Targeting State
  const [colleges, setColleges] = useState<Array<{ id: string | number; college_name: string }>>([]);
  const [targetCollegeId, setTargetCollegeId] = useState<string>('ALL');
  const [targetCourse, setTargetCourse] = useState<string>('ALL');
  const [targetBranch, setTargetBranch] = useState<string>('ALL');
  const [targetSection, setTargetSection] = useState<string>('ALL');
  const [loadingCohort, setLoadingCohort] = useState(false);
  const [cohortMatchCount, setCohortMatchCount] = useState<number | null>(null);

  // Unified Mail Templates Catalog & Live Preview State
  const [templates, setTemplates] = useState<MailTemplateDefinition[]>([]);
  const [showTemplatesCatalog, setShowTemplatesCatalog] = useState(true);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [composeVariables, setComposeVariables] = useState<Record<string, string>>({});
  const [loadingComposePreview, setLoadingComposePreview] = useState(false);

  // Recent Mail IDs & Saved Drafts Studio State
  const [drafts, setDrafts] = useState<MailDraftRecord[]>([]);
  const [recentRecipients, setRecentRecipients] = useState<RecentMailRecipient[]>([]);
  const [showDraftsPanel, setShowDraftsPanel] = useState(true);
  const [recentSearch, setRecentSearch] = useState('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [templatePreviewModal, setTemplatePreviewModal] = useState<{
    tpl: MailTemplateDefinition;
    vars: Record<string, string>;
    renderedSubject: string;
    renderedHtml: string;
    loading: boolean;
  } | null>(null);

  const templateSelectOptions = templates.length > 0
    ? templates.map((t) => ({ value: t.key, label: `${t.key} — ${t.name}` }))
    : FALLBACK_TEMPLATE_OPTIONS;

  const fetchDraftsAndRecent = useCallback(() => {
    listMailDrafts()
      .then((res) => {
        if (res.data?.drafts) setDrafts(res.data.drafts);
      })
      .catch(() => {});
    listRecentMailRecipients(40)
      .then((res) => {
        if (res.data?.recipients) setRecentRecipients(res.data.recipients);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    listColleges()
      .then((res) => setColleges(res.data?.colleges || []))
      .catch(() => {});
    listMailTemplates()
      .then((res) => {
        if (res.data?.templates) {
          setTemplates(res.data.templates);
        }
      })
      .catch(() => {});
    fetchDraftsAndRecent();
  }, [fetchDraftsAndRecent]);

  const handleOpenQuickDraft = async (
    draftKey: 'forgot_password_draft' | 'platform_update_draft' | 'test_completion_draft',
    recipient?: RecentMailRecipient
  ) => {
    const vars: Record<string, string> = {};
    if (draftKey === 'forgot_password_draft') {
      vars.name = recipient?.name || 'Candidate';
      vars.email = recipient?.email || 'student@college.edu';
      vars.hallTicket = recipient?.hallTicket || '24HU1A05F9';
      vars.portalName = recipient?.role === 'faculty' ? 'Faculty Portal' : recipient?.role === 'inspector' ? 'Inspector Console' : 'Student Portal';
    } else if (draftKey === 'platform_update_draft') {
      vars.name = recipient?.name || 'All Candidates';
      vars.updateTitle = 'Portal & Scheduled Examination Updates';
    } else if (draftKey === 'test_completion_draft') {
      vars.name = recipient?.name || 'Candidate';
      vars.hallTicket = recipient?.hallTicket || '24HU1A05F9';
      vars.testsSummary = recipient?.recentTestsSummary || 'Assessment Completed: Recorded cleanly in scorecard portal.';
    }

    setEditingDraftId(null);
    setDraftTitle(
      recipient
        ? `${draftKey.replace('_draft', '').replace('_', ' ')} — ${recipient.name}`
        : draftKey.replace(/_/g, ' ')
    );
    if (recipient?.email) {
      setComposeTo(recipient.email);
    }
    setComposeTemplate(draftKey);
    setComposeVariables(vars);
    setIsComposeOpen(true);
    setLoadingComposePreview(true);
    try {
      const res = await previewMailTemplate({ templateKey: draftKey, variables: vars });
      setComposeSubject(res.data.subject);
      setComposeBody(res.data.html);
    } catch {
    } finally {
      setLoadingComposePreview(false);
    }
  };

  const handleAppendRecentRecipient = (email: string) => {
    setComposeTo((prev) => {
      const list = prev
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!list.includes(email)) list.push(email);
      return list.join(', ');
    });
  };

  const handleSaveAsDraft = async () => {
    if (!composeSubject.trim()) {
      showToast('Enter a subject line before saving this draft.', 'error');
      return;
    }
    setSavingDraft(true);
    try {
      const res = await saveMailDraft({
        id: editingDraftId || undefined,
        title: draftTitle.trim() || composeSubject.trim().slice(0, 60),
        templateKey: composeTemplate,
        to: composeTo.trim(),
        cc: composeCc.trim() || undefined,
        subject: composeSubject.trim(),
        html: composeBody.trim(),
        variables: composeVariables,
      });
      if (res.data?.success) {
        showToast('Draft mail saved cleanly and ready for dispatch.', 'success');
        setEditingDraftId(null);
        setDraftTitle('');
        setIsComposeOpen(false);
        fetchDraftsAndRecent();
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save draft mail'), 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadSavedDraft = (draft: MailDraftRecord) => {
    setEditingDraftId(draft.id);
    setDraftTitle(draft.title);
    setComposeTemplate(draft.templateKey || 'custom_broadcast');
    setComposeTo(draft.to || '');
    setComposeCc(draft.cc || '');
    setComposeSubject(draft.subject || '');
    setComposeBody(draft.html || '');
    const strVars: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft.variables || {})) {
      strVars[k] = String(v ?? '');
    }
    setComposeVariables(strVars);
    setIsComposeOpen(true);
  };

  const handleSendSavedDraftNow = async (draft: MailDraftRecord) => {
    if (!draft.to || !draft.to.trim()) {
      handleLoadSavedDraft(draft);
      showToast('Add recipient email(s) in the Composer and click Dispatch.', 'error');
      return;
    }
    setSendingDraftId(draft.id);
    try {
      const res = await sendMailDraft(draft.id);
      if (res.data?.success) {
        setDispatchPulse(true);
        setTimeout(() => setDispatchPulse(false), 1800);
        showToast(`Draft "${draft.title}" dispatched to ${draft.to}.`, 'success');
        fetchDraftsAndRecent();
        fetchLogs();
        fetchForwardersAndRelay();
      } else {
        showToast(res.data?.message || 'Failed to dispatch draft.', 'error');
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to dispatch draft'), 'error');
    } finally {
      setSendingDraftId(null);
    }
  };

  const handleDeleteSavedDraft = async (id: string) => {
    try {
      await deleteMailDraft(id);
      showToast('Draft deleted.', 'success');
      fetchDraftsAndRecent();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete draft'), 'error');
    }
  };

  const buildDefaultVars = (tpl: MailTemplateDefinition): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const v of tpl.variables) out[v.key] = v.defaultValue;
    return out;
  };

  const handleOpenTemplatePreview = async (tpl: MailTemplateDefinition, customVars?: Record<string, string>) => {
    const vars = customVars || buildDefaultVars(tpl);
    setTemplatePreviewModal({
      tpl,
      vars,
      renderedSubject: `Rendering ${tpl.name}...`,
      renderedHtml: '',
      loading: true,
    });
    try {
      const res = await previewMailTemplate({ templateKey: tpl.key, variables: vars });
      setTemplatePreviewModal({
        tpl,
        vars,
        renderedSubject: res.data.subject,
        renderedHtml: res.data.html,
        loading: false,
      });
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to render template preview'), 'error');
      setTemplatePreviewModal(null);
    }
  };

  const handleLoadTemplateIntoComposer = async (tpl: MailTemplateDefinition, varsOverride?: Record<string, string>) => {
    const vars = varsOverride || buildDefaultVars(tpl);
    setComposeTemplate(tpl.key);
    setComposeVariables(vars);
    setIsComposeOpen(true);
    setLoadingComposePreview(true);
    try {
      const res = await previewMailTemplate({ templateKey: tpl.key, variables: vars });
      setComposeSubject(res.data.subject);
      setComposeBody(res.data.html);
    } catch {
      // Fallback safely
    } finally {
      setLoadingComposePreview(false);
    }
  };

  const handleComposerTemplateChange = async (templateKey: string) => {
    setComposeTemplate(templateKey);
    const tpl = templates.find((t) => t.key === templateKey);
    if (!tpl) {
      setComposeVariables({});
      return;
    }
    const vars = buildDefaultVars(tpl);
    setComposeVariables(vars);
    setLoadingComposePreview(true);
    try {
      const res = await previewMailTemplate({ templateKey: tpl.key, variables: vars });
      setComposeSubject(res.data.subject);
      setComposeBody(res.data.html);
    } catch {
    } finally {
      setLoadingComposePreview(false);
    }
  };

  const handleRefreshComposerPreview = async () => {
    setLoadingComposePreview(true);
    try {
      const res = await previewMailTemplate({ templateKey: composeTemplate, variables: composeVariables });
      setComposeSubject(res.data.subject);
      setComposeBody(res.data.html);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to render template'), 'error');
    } finally {
      setLoadingComposePreview(false);
    }
  };

  const handleLoadCohortRecipients = async () => {
    setLoadingCohort(true);
    setCohortMatchCount(null);
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/students`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const students: any[] = res.data?.students || [];
      const matched = students.filter((st) => {
        if (st.is_blocked) return false;
        if (targetCollegeId !== 'ALL' && String(st.college_id || '') !== String(targetCollegeId)) return false;
        const stBranch = (st.branch_code || st.branch || '').toUpperCase();
        if (targetCourse !== 'ALL' && inferCourseFromBranch(stBranch) !== targetCourse) return false;
        if (targetBranch !== 'ALL' && stBranch !== targetBranch.toUpperCase()) return false;
        if (targetSection !== 'ALL') {
          const sA = String(st.section || '').toUpperCase().replace(/^SECTION\s*/i, '').trim();
          const sB = targetSection.toUpperCase().replace(/^SECTION\s*/i, '').trim();
          if (sA !== sB && !sA.endsWith(`-${sB}`)) return false;
        }
        return Boolean(st.email && String(st.email).includes('@'));
      });
      const emails = Array.from(new Set(matched.map((s) => String(s.email).trim())));
      setCohortMatchCount(emails.length);
      if (emails.length > 0) {
        setComposeTo(emails.join(', '));
        showToast(`Loaded ${emails.length} matching cohort recipient email${emails.length === 1 ? '' : 's'}.`, 'success');
      } else {
        showToast('No active students matched the selected College/Course/Branch/Section filter.', 'error');
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load cohort recipients'), 'error');
    } finally {
      setLoadingCohort(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleDirectDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      showToast('Please fill in recipient, subject, and message content.', 'error');
      return;
    }
    setSendingEmail(true);
    try {
      const res = await dispatchAdminEmail({
        to: composeTo.trim(),
        ...(composeCc.trim() ? { cc: composeCc.trim() } : {}),
        subject: composeSubject.trim(),
        html: composeBody.trim(),
        template: composeTemplate,
        templateKey: composeTemplate,
        variables: composeVariables,
      });
      if (res.data?.success) {
        setDispatchPulse(true);
        setTimeout(() => setDispatchPulse(false), 1800);
        showToast('Official email dispatched successfully.', 'success');
        setIsComposeOpen(false);
        setComposeTo('');
        setComposeCc('');
        fetchLogs();
        fetchForwardersAndRelay();
      } else {
        showToast(res.data?.message || 'Failed to dispatch email.', 'error');
      }
    } catch (err: any) {
      showToast(err?.response?.data?.error || err.message || 'Dispatch failed.', 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  const fetchForwardersAndRelay = useCallback(async () => {
    try {
      const [fwdRes, statsRes] = await Promise.all([
        listMailForwarders().catch(() => null),
        getMailStats().catch(() => null),
      ]);
      if (fwdRes?.data?.forwarders) {
        setForwarders(fwdRes.data.forwarders);
      }
      if (statsRes?.data?.quota || statsRes?.data?.queue) {
        setMailRelayStats({
          sentCount: statsRes.data.quota?.sentCount ?? 0,
          dailyCap: statsRes.data.quota?.dailyCap ?? 100,
          pending: statsRes.data.queue?.pending ?? 0,
          processing: statsRes.data.queue?.processing ?? 0,
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchForwardersAndRelay();
  }, [fetchForwardersAndRelay]);

  const handleSaveForwarderRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleEmail.trim() || !newRuleEmail.includes('@')) {
      showToast('Enter a valid destination email address for forwarding.', 'error');
      return;
    }
    setSavingRule(true);
    try {
      const res = await saveMailForwarder({
        name: newRuleName.trim() || `${newRuleTemplate} Forwarder`,
        template: newRuleTemplate,
        forwardTo: newRuleEmail.trim(),
        mode: newRuleMode,
        enabled: true,
      });
      if (res.data?.success) {
        showToast('Auto-forwarder rule activated.', 'success');
        setNewRuleName('');
        setNewRuleEmail('');
        fetchForwardersAndRelay();
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save forwarder rule'), 'error');
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleForwarder = async (rule: MailForwarderRule) => {
    try {
      await saveMailForwarder({ ...rule, enabled: !rule.enabled });
      showToast(`${rule.name} ${rule.enabled ? 'paused' : 'enabled'}.`, 'success');
      fetchForwardersAndRelay();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update forwarder'), 'error');
    }
  };

  const handleDeleteForwarder = async (id: string) => {
    try {
      await deleteMailForwarder(id);
      showToast('Forwarder rule deleted.', 'success');
      fetchForwardersAndRelay();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to remove forwarder'), 'error');
    }
  };

  const handleForwardExistingLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forwardModalLog || !forwardTarget.trim()) {
      showToast('Enter a target recipient email address.', 'error');
      return;
    }
    setForwardingEmail(true);
    try {
      const res = await forwardMailLog(forwardModalLog.id, {
        forwardTo: forwardTarget.trim(),
        note: forwardNote.trim() || undefined,
      });
      if (res.data?.success) {
        setDispatchPulse(true);
        setTimeout(() => setDispatchPulse(false), 1800);
        showToast(res.data.message || `Forwarded to ${forwardTarget}`, 'success');
        setForwardModalLog(null);
        setForwardTarget('');
        setForwardNote('');
        fetchLogs();
        fetchForwardersAndRelay();
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to forward email'), 'error');
    } finally {
      setForwardingEmail(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMailLogs({
        page,
        limit: 15,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        template: filterTemplate !== 'all' ? filterTemplate : undefined,
        search: search.trim() || undefined,
      });
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        setTotal(res.data.total || 0);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch outbound mail logs'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterTemplate, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResend = async (logId: string) => {
    setResendingId(logId);
    try {
      const res = await resendMailLog(logId);
      if (res.data?.success) {
        showToast('Email re-dispatched via Resend API.', 'success');
        // Refresh logs list
        fetchLogs();
      } else {
        showToast('Resend failed: Server returned an unsuccessful status', 'error');
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to re-dispatch email'), 'error');
    } finally {
      setResendingId(null);
    }
  };

  const getTemplateBadgeStyle = (template: string) => {
    switch (template) {
      case 'faculty_created':
        return { background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)' };
      case 'inspector_created':
        return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.35)' };
      case 'admin_welcome':
        return { background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.35)' };
      case 'student_otp':
        return { background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', border: '1px solid rgba(14, 165, 233, 0.35)' };
      case 'student_registered':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)' };
      case 'exam_scheduled':
        return { background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.35)' };
      case 'admin_alert':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' };
      case 'result_report':
        return { background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)' };
      case 'faculty_paper_allocated':
        return { background: 'rgba(192, 132, 252, 0.15)', color: '#e879f9', border: '1px solid rgba(192, 132, 252, 0.35)' };
      default:
        return { background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.35)' };
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'sent' || status === 'delivered') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 9999,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
          Delivered
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 9999,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#f87171',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
        Failed
      </span>
    );
  };

  return (
    <AnimatedPage>
      <div className="admin-layout">
        <AdminSidebar activeTab="mail-logs" />

        <main className="admin-content" style={{ position: 'relative', overflow: 'hidden' }}>
          <ParticleField liveCount={Math.max(1, logs.length)} particleCount={150} color="var(--color-primary, #00d2ff)" />

          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><IconMail size={22} color="#38BDF8" /><span>Outbound Email Dispatch Logs</span></span>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
                    Resend API
                  </span>
                </h1>
                <p className="text-muted text-sm">
                  Live institutional audit of outbound role-based communications, Resend delivery IDs, status telemetry, and manual re-dispatch.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowDraftsPanel((v) => !v)}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: showDraftsPanel ? 'rgba(16,185,129,0.45)' : undefined }}
                >
                  <IconMail size={14} color="#34D399" />
                  <span>{showDraftsPanel ? 'Hide Drafts' : `Draft Mails (${drafts.length})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTemplatesCatalog((v) => !v)}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: showTemplatesCatalog ? 'rgba(56,189,248,0.45)' : undefined }}
                >
                  <IconEye size={14} color="#38BDF8" />
                  <span>{showTemplatesCatalog ? 'Hide Templates' : `Mail Templates (${templates.length || 25})`}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowForwardersPanel((v) => !v)}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <IconFlash size={14} color="#FFB400" />
                  <span>{showForwardersPanel ? 'Hide Forwarders' : `Mail Forwarders (${forwarders.length})`}</span>
                </button>

                <button
                  onClick={() => setIsComposeOpen(true)}
                  className="btn btn-sm btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0284c7', color: '#fff', fontWeight: 700 }}
                >
                  <IconMail size={15} style={{ marginRight: 6 }} />
                  <span>Compose &amp; Dispatch Email</span>
                </button>

                <button
                  onClick={() => { fetchLogs(); fetchForwardersAndRelay(); }}
                  disabled={loading}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <IconRefresh size={15} style={{ marginRight: 6 }} />
                  <span>{loading ? 'Refreshing...' : 'Refresh Logs'}</span>
                </button>
              </div>
            </div>

            {/* Animated Live Mail Relay & Forwarder Pipeline Visualizer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{
                marginBottom: 22,
                padding: '18px 20px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(14, 26, 46, 0.96) 0%, rgba(10, 18, 38, 0.98) 100%)',
                border: dispatchPulse ? '1.5px solid #10B981' : '1px solid rgba(56, 189, 248, 0.28)',
                boxShadow: dispatchPulse ? '0 0 28px rgba(16, 185, 129, 0.25)' : '0 8px 28px rgba(0,0,0,0.35)',
                transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <motion.span
                    animate={{ scale: [1, 1.35, 1], opacity: [0.85, 0.35, 0.85] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    style={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 10px #10B981' }}
                  />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Live Mail Relay &amp; Auto-Forwarding Pipeline
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '0.76rem', fontFamily: 'monospace', color: '#94A3B8' }}>
                  <span>Daily Quota: <strong style={{ color: '#FFB400' }}>{mailRelayStats.sentCount} / {mailRelayStats.dailyCap}</strong></span>
                  <span>Queue: <strong style={{ color: '#34D399' }}>{mailRelayStats.pending + mailRelayStats.processing} active</strong></span>
                  <span>Forwarders: <strong style={{ color: '#A78BFA' }}>{forwarders.filter((f) => f.enabled).length} enabled</strong></span>
                </div>
              </div>

              {/* Animated Relay Track */}
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto 1fr auto', alignItems: 'center', gap: 10 }}>
                {[
                  { label: 'App Dispatch', sub: 'Recovery & Alerts', color: '#38BDF8' },
                  { label: 'Queue Relay', sub: '3x Worker Pool', color: '#FFB400' },
                  { label: 'Forwarder Bus', sub: `${forwarders.filter((f) => f.enabled).length} Active Rules`, color: '#A78BFA' },
                  { label: 'Candidate Inbox', sub: 'Resend / SMTP', color: '#10B981' },
                ].flatMap((node, idx, arr) => {
                  const nodeEl = (
                    <motion.div
                      key={node.label}
                      whileHover={{ y: -2 }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: `${node.color}14`,
                        border: `1px solid ${node.color}40`,
                        textAlign: 'center',
                        minWidth: 108,
                      }}
                    >
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: node.color }}>{node.label}</div>
                      <div style={{ fontSize: '0.66rem', color: '#94A3B8', marginTop: 2 }}>{node.sub}</div>
                    </motion.div>
                  );
                  if (idx === arr.length - 1) return [nodeEl];
                  const trackEl = (
                    <div key={`track-${idx}`} style={{ position: 'relative', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                      <motion.div
                        animate={{ x: ['-40%', '140%'] }}
                        transition={{ duration: dispatchPulse ? 0.75 : 2.1, repeat: Infinity, delay: idx * 0.35, ease: 'linear' }}
                        style={{
                          width: '38%',
                          height: '100%',
                          borderRadius: 4,
                          background: `linear-gradient(90deg, transparent, ${node.color}, transparent)`,
                        }}
                      />
                    </div>
                  );
                  return [nodeEl, trackEl];
                })}
              </div>
            </motion.div>

            {/* Configurable Mail Forwarders Management Panel */}
            <AnimatePresence>
              {showForwardersPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden', marginBottom: 22 }}
                >
                  <div className="card" style={{ padding: '18px 20px', border: '1px solid rgba(167, 139, 250, 0.3)', background: 'rgba(13, 24, 53, 0.9)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <IconFlash size={16} color="#A78BFA" />
                          <span>Automated Mail Forwarders &amp; Routing Rules</span>
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                          Automatically forward copies of Password Resets, User ID Recoveries, Exam Invitations, or Security Alerts to department heads or backup inboxes.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveForwarderRule} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(180px, 1fr) minmax(200px, 1.4fr) minmax(130px, 0.8fr) auto', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                      <input
                        type="text"
                        className="form-input form-input-sm"
                        placeholder="Rule label (e.g. HOD Copy)"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                      />
                      <select
                        className="form-input form-input-sm"
                        value={newRuleTemplate}
                        onChange={(e) => setNewRuleTemplate(e.target.value)}
                      >
                        <option value="all">All Outbound Templates</option>
                        {templateSelectOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        className="form-input form-input-sm"
                        placeholder="Forward to email(s), comma-separated"
                        value={newRuleEmail}
                        onChange={(e) => setNewRuleEmail(e.target.value)}
                        required
                      />
                      <select
                        className="form-input form-input-sm"
                        value={newRuleMode}
                        onChange={(e) => setNewRuleMode(e.target.value as 'forward_copy' | 'bcc')}
                      >
                        <option value="forward_copy">Forward Copy ([FWD])</option>
                        <option value="bcc">Silent BCC Copy</option>
                      </select>
                      <button type="submit" disabled={savingRule} className="btn btn-sm btn-primary" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <IconPlus size={14} />
                        <span>{savingRule ? 'Saving...' : 'Add Forwarder'}</span>
                      </button>
                    </form>

                    {forwarders.length === 0 ? (
                      <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', fontSize: '0.78rem', color: '#94A3B8', textAlign: 'center' }}>
                        No automatic mail forwarders active yet. Add a rule above or use the <strong style={{ color: '#38BDF8' }}>Forward</strong> action on any dispatched log row below.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {forwarders.map((rule) => (
                          <div
                            key={rule.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 10,
                              padding: '10px 14px',
                              borderRadius: 10,
                              background: 'rgba(7, 13, 30, 0.75)',
                              border: rule.enabled ? '1px solid rgba(167, 139, 250, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#F8FAFC' }}>{rule.name}</span>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(56,189,248,0.14)', color: '#38BDF8' }}>
                                {rule.template}
                              </span>
                              <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>→</span>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#FBBF24' }}>{rule.forwardTo}</span>
                              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>({rule.mode === 'bcc' ? 'Silent BCC' : 'Forwarded Copy'} • {rule.forwardCount || 0} relayed)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleToggleForwarder(rule)}
                                className="btn btn-xs btn-secondary"
                                style={{ color: rule.enabled ? '#34D399' : '#94A3B8' }}
                              >
                                {rule.enabled ? 'Enabled' : 'Paused'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteForwarder(rule.id)}
                                className="btn btn-xs btn-secondary"
                                style={{ color: '#F87171', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconTrash size={12} /> Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* All System Mail Templates & Event Dispatch Catalog */}
            <AnimatePresence>
              {showTemplatesCatalog && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden', marginBottom: 22 }}
                >
                  <div className="card" style={{ padding: '18px 20px', border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(13, 24, 53, 0.92)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <IconMail size={16} color="#38BDF8" />
                          <span>System Mail Templates &amp; Automated Event Registry ({templates.length || 25})</span>
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                          Preview, customize parameters, route auto-forwarders, or dispatch any standardized event template across every portal and service.
                        </p>
                      </div>

                      <input
                        type="text"
                        className="form-input form-input-sm"
                        placeholder="Search templates or event trigger..."
                        value={templateSearch}
                        onChange={(e) => setTemplateSearch(e.target.value)}
                        style={{ minWidth: 230 }}
                      />
                    </div>

                    {/* Category Filter Tabs */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      {[
                        { key: 'all', label: `All Templates (${templates.length})` },
                        { key: 'auth_recovery', label: 'Auth & Recovery' },
                        { key: 'exam_lifecycle', label: 'Exam Lifecycle' },
                        { key: 'proctoring_security', label: 'Proctoring & Security' },
                        { key: 'support_ops', label: 'Support & Operations' },
                      ].map((tab) => {
                        const active = templateCategoryFilter === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setTemplateCategoryFilter(tab.key)}
                            className={`btn btn-xs ${active ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                              fontWeight: 700,
                              background: active ? '#0284c7' : undefined,
                              color: active ? '#ffffff' : '#cbd5e1',
                            }}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
                      {templates
                        .filter((t) => templateCategoryFilter === 'all' || t.category === templateCategoryFilter)
                        .filter((t) => {
                          if (!templateSearch.trim()) return true;
                          const q = templateSearch.toLowerCase();
                          return (
                            t.key.toLowerCase().includes(q) ||
                            t.name.toLowerCase().includes(q) ||
                            t.triggerEvent.toLowerCase().includes(q) ||
                            t.audience.toLowerCase().includes(q) ||
                            t.description.toLowerCase().includes(q)
                          );
                        })
                        .map((tpl, idx) => (
                          <motion.div
                            key={tpl.key}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, delay: Math.min(idx * 0.02, 0.24) }}
                            style={{
                              padding: '13px 14px',
                              borderRadius: 11,
                              background: 'rgba(7, 13, 30, 0.85)',
                              border: '1px solid rgba(255,255,255,0.09)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6, ...getTemplateBadgeStyle(tpl.key) }}>
                                  {tpl.key}
                                </span>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94A3B8' }}>
                                  {tpl.categoryLabel}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#F8FAFC', marginBottom: 4 }}>
                                {tpl.name}
                              </div>
                              <p style={{ margin: '0 0 6px', fontSize: '0.75rem', color: '#94A3B8', lineHeight: 1.45 }}>
                                {tpl.description}
                              </p>
                              <div style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#38BDF8', opacity: 0.9, wordBreak: 'break-word' }}>
                                Event: {tpl.triggerEvent}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: '#A78BFA', marginTop: 2 }}>
                                Audience: {tpl.audience}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenTemplatePreview(tpl)}
                                className="btn btn-xs btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <IconEye size={12} color="#38BDF8" /> Preview
                              </button>
                              <button
                                type="button"
                                onClick={() => handleLoadTemplateIntoComposer(tpl)}
                                className="btn btn-xs btn-primary"
                                style={{ background: '#0284c7', fontWeight: 700 }}
                              >
                                Use &amp; Dispatch
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowForwardersPanel(true);
                                  setNewRuleTemplate(tpl.key);
                                  setNewRuleName(`${tpl.name} Copy`);
                                  showToast(`Selected "${tpl.key}" in Automated Forwarders.`, 'success');
                                }}
                                className="btn btn-xs btn-secondary"
                                style={{ color: '#A78BFA' }}
                              >
                                Auto-Fwd
                              </button>
                            </div>
                          </motion.div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recent Mail IDs & Draft Mails Studio (Forgot Password, Updates & Completed Tests Drafts) */}
            <AnimatePresence>
              {showDraftsPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden', marginBottom: 22 }}
                >
                  <div className="card" style={{ padding: '18px 20px', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(13, 24, 53, 0.92)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <IconMail size={16} color="#34D399" />
                          <span>Draft Mails &amp; Recent Mail IDs Directory ({drafts.length} Saved • {recentRecipients.length} Recent IDs)</span>
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#94A3B8' }}>
                          Pick recent student/staff mail IDs, auto-generate drafts for Forgot Password, Portal Updates, or Completed Tests Summary, save drafts, and dispatch using the unified pipeline.
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickDraft('forgot_password_draft')}
                          className="btn btn-xs btn-secondary"
                          style={{ color: '#FBBF24', borderColor: 'rgba(255,180,0,0.35)' }}
                        >
                          + Forgot Password Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickDraft('platform_update_draft')}
                          className="btn btn-xs btn-secondary"
                          style={{ color: '#38BDF8', borderColor: 'rgba(56,189,248,0.35)' }}
                        >
                          + Portal Updates Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenQuickDraft('test_completion_draft')}
                          className="btn btn-xs btn-secondary"
                          style={{ color: '#34D399', borderColor: 'rgba(52,211,153,0.35)' }}
                        >
                          + Completed Tests Draft
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                      {/* Column 1: Recent Mail IDs with 1-Click Tailored Drafts */}
                      <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(7,13,30,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase' }}>
                            Recent Mail IDs &amp; Activity
                          </span>
                          <input
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="Filter recent emails / IDs..."
                            value={recentSearch}
                            onChange={(e) => setRecentSearch(e.target.value)}
                            style={{ maxWidth: 190 }}
                          />
                        </div>

                        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {recentRecipients
                            .filter((r) => {
                              if (!recentSearch.trim()) return true;
                              const q = recentSearch.toLowerCase();
                              return (
                                r.email.toLowerCase().includes(q) ||
                                r.name.toLowerCase().includes(q) ||
                                (r.hallTicket || '').toLowerCase().includes(q)
                              );
                            })
                            .slice(0, 16)
                            .map((rec) => (
                              <div
                                key={rec.email}
                                style={{
                                  padding: '9px 11px',
                                  borderRadius: 9,
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.07)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#F8FAFC' }}>{rec.name}</span>
                                    {rec.hallTicket && (
                                      <span style={{ marginLeft: 6, fontFamily: 'monospace', fontSize: '0.72rem', color: '#FBBF24' }}>{rec.hallTicket}</span>
                                    )}
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#38BDF8' }}>{rec.email}</div>
                                  </div>
                                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: 'rgba(56,189,248,0.12)', color: '#94A3B8', textTransform: 'uppercase' }}>
                                    {rec.role} {rec.completedTestsCount > 0 ? `• ${rec.completedTestsCount} tests` : ''}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickDraft('forgot_password_draft', rec)}
                                    className="btn btn-xs btn-secondary"
                                    style={{ fontSize: '0.68rem', color: '#FBBF24' }}
                                  >
                                    Forgot Password Draft
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickDraft('platform_update_draft', rec)}
                                    className="btn btn-xs btn-secondary"
                                    style={{ fontSize: '0.68rem', color: '#38BDF8' }}
                                  >
                                    Updates Draft
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenQuickDraft('test_completion_draft', rec)}
                                    className="btn btn-xs btn-secondary"
                                    style={{ fontSize: '0.68rem', color: '#34D399' }}
                                  >
                                    Tests Done Draft
                                  </button>
                                </div>
                              </div>
                            ))}
                          {recentRecipients.length === 0 && (
                            <div style={{ padding: 18, textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8' }}>
                              Recent student, staff, and dispatched mail IDs will populate here automatically.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Saved Draft Mails Queue */}
                      <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(7,13,30,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#34D399', textTransform: 'uppercase' }}>
                            Saved Draft Mails ({drafts.length})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDraftId(null);
                              setDraftTitle('');
                              setIsComposeOpen(true);
                            }}
                            className="btn btn-xs btn-primary"
                            style={{ background: '#059669', fontWeight: 700 }}
                          >
                            + New Draft
                          </button>
                        </div>

                        <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {drafts.length === 0 ? (
                            <div style={{ padding: 20, textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8' }}>
                              No saved drafts yet. Pick a recent mail ID or click <strong>Save as Draft</strong> in the Composer.
                            </div>
                          ) : (
                            drafts.map((d) => (
                              <div
                                key={d.id}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: 9,
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(52,211,153,0.22)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 8,
                                }}
                              >
                                <div style={{ minWidth: 160, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#F8FAFC' }}>{d.title}</span>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: 5, ...getTemplateBadgeStyle(d.templateKey) }}>
                                      {d.templateKey}
                                    </span>
                                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: d.status === 'dispatched' ? '#34D399' : '#FBBF24' }}>
                                      {d.status === 'dispatched' ? 'Sent' : 'Draft'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#38BDF8', marginTop: 2 }}>
                                    To: {d.to || 'No recipient yet'}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleLoadSavedDraft(d)}
                                    className="btn btn-xs btn-secondary"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={sendingDraftId === d.id}
                                    onClick={() => handleSendSavedDraftNow(d)}
                                    className="btn btn-xs btn-primary"
                                    style={{ background: '#0284c7', fontWeight: 700 }}
                                  >
                                    {sendingDraftId === d.id ? 'Sending...' : 'Send Now'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSavedDraft(d.id)}
                                    className="btn btn-xs btn-secondary"
                                    style={{ color: '#F87171' }}
                                    aria-label="Delete draft"
                                  >
                                    <IconTrash size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Toast Notification */}
            {toast && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '12px 18px',
                  borderRadius: 10,
                  background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                  color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span>{toast.type === 'success' ? <IconCheck size={16} color='#10B981' /> : <IconCross size={16} color='#EF4444' />}</span>
                <span>{toast.message}</span>
              </div>
            )}

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="card card-sm" style={{ borderLeft: '3px solid #38bdf8' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Total Outbound Logs
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  {stats.total || logs.length}
                </div>
              </div>

              <div className="card card-sm" style={{ borderLeft: '3px solid #10b981' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Successfully Dispatched
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                  {stats.sent || logs.filter((l) => l.status === 'sent' || l.status === 'delivered').length}
                </div>
              </div>

              <div className="card card-sm" style={{ borderLeft: '3px solid #ef4444' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  Failed Dispatches
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444' }}>
                  {stats.failed || logs.filter((l) => l.status === 'failed').length}
                </div>
              </div>

              <div className="card card-sm" style={{ borderLeft: '3px solid #a855f7' }}>
                <div className="text-muted text-xs font-mono" style={{ textTransform: 'uppercase', marginBottom: 4 }}>
                  System Event Templates
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#c084fc' }}>
                  {templates.length || 25} Active
                </div>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div
              className="card card-sm"
              style={{
                marginBottom: 20,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flex: 1, minWidth: 260, gap: 10 }}>
                <input
                  type="text"
                  placeholder="Search by recipient email or subject..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input"
                  style={{ width: '100%', maxWidth: 360 }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                {/* Template Filter */}
                <select
                  value={filterTemplate}
                  onChange={(e) => {
                    setFilterTemplate(e.target.value);
                    setPage(1);
                  }}
                  className="input"
                  style={{ width: 'auto', minWidth: 220 }}
                >
                  <option value="all">All Event &amp; Role Templates</option>
                  {templateSelectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="input"
                  style={{ width: 'auto', minWidth: 140 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="sent">Delivered / Sent</option>
                  <option value="failed">Failed Delivery</option>
                </select>
              </div>
            </div>

            {/* Mail Logs Data Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Recipient</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Role Template</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Subject</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Resend ID</th>
                      <th style={{ padding: '14px 18px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Timestamp</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                          Loading email dispatch records...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                          <div style={{ display: 'inline-flex', padding: 14, borderRadius: '50%', background: 'rgba(56, 189, 248, 0.1)', marginBottom: 10 }}><IconMail size={32} color="#38BDF8" /></div>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)' }}>No Outbound Emails Found</div>
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: 4 }}>
                            {search || filterStatus !== 'all' || filterTemplate !== 'all'
                              ? 'Try adjusting your search criteria or status filter.'
                              : 'Outbound emails sent via Resend will appear here in real-time.'}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      logs.map((item, rowIdx) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(rowIdx * 0.03, 0.25) }}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {/* Status Badge */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            {getStatusBadge(item.status)}
                          </td>

                          {/* Recipient */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                              {item.to_email}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Via {item.sent_by || 'system'}
                            </div>
                          </td>

                          {/* Template */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: 6,
                                fontSize: '12px',
                                fontWeight: 700,
                                ...getTemplateBadgeStyle(item.template),
                              }}
                            >
                              {item.template}
                            </span>
                          </td>

                          {/* Subject */}
                          <td style={{ padding: '14px 18px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: '13px', color: 'var(--color-text)' }} title={item.subject}>
                              {item.subject}
                            </div>
                            {item.error_message && (
                              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: 2 }} title={item.error_message}>
                                {item.error_message}
                              </div>
                            )}
                          </td>

                          {/* Resend ID */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                            {item.resend_id ? item.resend_id.slice(0, 16) + '...' : '—'}
                          </td>

                          {/* Timestamp */}
                          <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: '12px', color: '#94a3b8' }}>
                            {new Date(item.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Action Buttons */}
                          <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 8 }}>
                              {item.html_content && (
                                <button
                                  onClick={() => setPreviewLog(item)}
                                  className="btn btn-xs btn-secondary"
                                  title="View rendered email preview"
                                >
                                  Preview
                                </button>
                              )}

                              <button
                                onClick={() => setForwardModalLog(item)}
                                className="btn btn-xs btn-secondary"
                                title="Forward this email transmission to another recipient"
                                style={{ color: '#A78BFA', borderColor: 'rgba(167,139,250,0.35)' }}
                              >
                                Forward
                              </button>

                              <button
                                onClick={() => handleResend(item.id)}
                                disabled={resendingId === item.id}
                                className="btn btn-xs btn-primary"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                }}
                              >
                                {resendingId === item.id ? (
                                  <span>Sending...</span>
                                ) : (
                                  <>
                                    <IconRefresh size={14} />
                                    <span>Resend</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {total > 15 && (
                <div
                  style={{
                    padding: '14px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of {total} records
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn btn-xs btn-secondary"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * 15 >= total}
                      className="btn btn-xs btn-secondary"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* HTML Email Preview Modal */}
      {previewLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setPreviewLog(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '90vh',
              background: '#0d1835',
              border: '1px solid rgba(56,189,248,0.3)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                  {previewLog.subject}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: 2 }}>
                  To: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{previewLog.to_email}</span> • Template: <span style={{ fontWeight: 700 }}>{previewLog.template}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => handleResend(previewLog.id)}
                  disabled={resendingId === previewLog.id}
                  className="btn btn-xs btn-primary"
                >
                  {resendingId === previewLog.id ? 'Sending...' : 'Resend Now'}
                </button>
                <button onClick={() => setPreviewLog(null)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "inline-flex", alignItems: "center" }} aria-label="Close"><IconCross size={18} color="#94A3B8" /></button>
              </div>
            </div>

            {/* Modal Body / Iframe preview */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#070d1e' }}>
              <iframe
                title="Email Preview"
                srcDoc={previewLog.html_content || '<p>No content preview available</p>'}
                style={{
                  width: '100%',
                  height: 520,
                  border: 'none',
                  borderRadius: 10,
                  background: '#ffffff',
                }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

      {/* Compose & Dispatch Modal */}
      {isComposeOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setIsComposeOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#0d1835',
              border: '1.5px solid rgba(2, 132, 199, 0.4)',
              borderRadius: 16,
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(2,132,199,0.15) 0%, transparent 100%)',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Compose &amp; Dispatch Official Email
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Targeted administrative dispatch with active anti-spam and fake recipient shielding.
                </p>
              </div>
              <button onClick={() => setIsComposeOpen(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "inline-flex", alignItems: "center" }} aria-label="Close"><IconCross size={18} color="#94A3B8" /></button>
            </div>

            <form onSubmit={handleDirectDispatch} style={{ padding: '20px 24px' }}>
              {/* Cohort Recipient Loader */}
              <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: '#070d1e', border: '1px solid rgba(56,189,248,0.22)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#38BDF8' }}>
                    Cohort Recipient Targeting (Optional)
                  </span>
                  {cohortMatchCount !== null && (
                    <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                      {cohortMatchCount} matched
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 8 }}>
                  <select
                    className="form-input form-input-sm"
                    value={targetCollegeId}
                    onChange={(e) => setTargetCollegeId(e.target.value)}
                  >
                    <option value="ALL">All Colleges</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.college_name}</option>
                    ))}
                  </select>
                  <select
                    className="form-input form-input-sm"
                    value={targetCourse}
                    onChange={(e) => { setTargetCourse(e.target.value); setTargetBranch('ALL'); }}
                  >
                    <option value="ALL">All Courses</option>
                    {COURSE_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <select
                    className="form-input form-input-sm"
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                  >
                    <option value="ALL">All Branches</option>
                    {getBranchesForCourse(targetCourse).map((b) => (
                      <option key={b.code} value={b.code}>{b.code}</option>
                    ))}
                  </select>
                  <select
                    className="form-input form-input-sm"
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value)}
                  >
                    <option value="ALL">All Sections</option>
                    {buildSectionChoices([], targetBranch).map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleLoadCohortRecipients}
                  disabled={loadingCohort}
                  className="btn btn-xs btn-secondary"
                  style={{ width: '100%', padding: '6px 10px' }}
                >
                  {loadingCohort ? 'Loading Matching Cohort...' : 'Load Matching Student Emails into Recipient Field'}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  System Event Template (Auto-Renders Institutional Brand HTML)
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    className="form-input"
                    value={composeTemplate}
                    onChange={(e) => handleComposerTemplateChange(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#070d1e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                  >
                    {templateSelectOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleRefreshComposerPreview}
                    disabled={loadingComposePreview}
                    className="btn btn-sm btn-secondary"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {loadingComposePreview ? 'Rendering...' : 'Render Template'}
                  </button>
                </div>
              </div>

              {(() => {
                const activeTpl = templates.find((t) => t.key === composeTemplate);
                if (!activeTpl || activeTpl.variables.length === 0) return null;
                return (
                  <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.28)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#C4B5FD' }}>
                        Template Variables — {activeTpl.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleRefreshComposerPreview}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.7rem' }}
                      >
                        Apply Variables to HTML
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                      {activeTpl.variables.map((vSpec) => (
                        <div key={vSpec.key}>
                          <label style={{ display: 'block', fontSize: '0.68rem', color: '#94A3B8', marginBottom: 3 }}>{vSpec.label}</label>
                          <input
                            type="text"
                            className="form-input form-input-sm"
                            value={composeVariables[vSpec.key] ?? vSpec.defaultValue}
                            onChange={(e) => setComposeVariables((prev) => ({ ...prev, [vSpec.key]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  Recipient Email Address(es)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. student@college.edu (comma-separated for multiple)"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#070d1e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                  required
                />
                {recentRecipients.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8', alignSelf: 'center' }}>Recent IDs:</span>
                    {recentRecipients.slice(0, 6).map((rec) => (
                      <button
                        key={rec.email}
                        type="button"
                        onClick={() => handleAppendRecentRecipient(rec.email)}
                        className="btn btn-xs btn-secondary"
                        style={{ fontSize: '0.68rem', padding: '2px 7px', color: '#38BDF8', borderColor: 'rgba(56,189,248,0.28)' }}
                        title={`${rec.name}${rec.hallTicket ? ` (${rec.hallTicket})` : ''}`}
                      >
                        + {rec.email}
                      </button>
                    ))}
                  </div>
                )}
                <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4, display: 'block' }}>
                  <IconShield size={14} color="#38BDF8" style={{ marginRight: 6 }} />Anti-spam shield: Simulated/demo domains (@example.com, @test.com) are safely intercepted.
                </span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  CC / Forward Copy Recipients (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. hod@college.edu, examcell@logicwhilelire.com"
                  value={composeCc}
                  onChange={(e) => setComposeCc(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#070d1e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  Subject Line
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#070d1e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                  required
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  Email Body (HTML / Formatted)
                </label>
                <textarea
                  className="form-input"
                  rows={6}
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#070d1e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'monospace', fontSize: '0.84rem' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <input
                  type="text"
                  className="form-input form-input-sm"
                  placeholder="Optional Draft Label..."
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  style={{ flex: '1 1 180px', maxWidth: 240 }}
                />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => { setIsComposeOpen(false); setEditingDraftId(null); }}
                    className="btn btn-secondary"
                    style={{ padding: '10px 16px', borderRadius: 8 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingDraft}
                    onClick={handleSaveAsDraft}
                    className="btn btn-secondary"
                    style={{ padding: '10px 16px', borderRadius: 8, borderColor: 'rgba(52,211,153,0.45)', color: '#34D399', fontWeight: 700 }}
                  >
                    {savingDraft ? 'Saving...' : editingDraftId ? 'Update Draft' : 'Save as Draft'}
                  </button>
                  <button
                    type="submit"
                    disabled={sendingEmail}
                    className="btn btn-primary"
                    style={{ padding: '10px 22px', borderRadius: 8, background: '#0284c7', color: '#fff', fontWeight: 800 }}
                  >
                    {sendingEmail ? 'Dispatching...' : 'Dispatch Now'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Email Forward Modal */}
      {forwardModalLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setForwardModalLog(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#0d1835',
              border: '1.5px solid rgba(167, 139, 250, 0.45)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(167,139,250,0.12)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>Forward Dispatched Email</h3>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: 2 }}>Fwd: {forwardModalLog.subject}</div>
              </div>
              <button onClick={() => setForwardModalLog(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }} aria-label="Close">
                <IconCross size={18} color="#94A3B8" />
              </button>
            </div>
            <form onSubmit={handleForwardExistingLog} style={{ padding: '20px 22px' }}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  Forward To Email Address(es)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="coordinator@college.edu, backup@domain.com"
                  value={forwardTarget}
                  onChange={(e) => setForwardTarget(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
                  Optional Forwarding Note
                </label>
                <textarea
                  rows={3}
                  className="form-input"
                  placeholder="Add an explanatory note above the forwarded message..."
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setForwardModalLog(null)}>Cancel</button>
                <button type="submit" disabled={forwardingEmail} className="btn btn-primary" style={{ background: '#7C3AED', fontWeight: 800 }}>
                  {forwardingEmail ? 'Forwarding...' : 'Send Forwarded Copy →'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Interactive Mail Template Live Preview & Parameter Modal */}
      {templatePreviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.84)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setTemplatePreviewModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              width: '100%',
              maxWidth: 920,
              maxHeight: '92vh',
              background: '#0d1835',
              border: '1.5px solid rgba(56,189,248,0.4)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 64px rgba(0,0,0,0.88)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(56,189,248,0.08)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, ...getTemplateBadgeStyle(templatePreviewModal.tpl.key) }}>
                    {templatePreviewModal.tpl.key}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC' }}>
                    {templatePreviewModal.tpl.name}
                  </h3>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#94A3B8', marginTop: 4 }}>
                  Subject: <span style={{ color: '#38BDF8', fontWeight: 600 }}>{templatePreviewModal.renderedSubject}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    const m = templatePreviewModal;
                    setTemplatePreviewModal(null);
                    handleLoadTemplateIntoComposer(m.tpl, m.vars);
                  }}
                  className="btn btn-xs btn-primary"
                  style={{ background: '#0284c7', fontWeight: 700 }}
                >
                  Open in Dispatch Composer →
                </button>
                <button onClick={() => setTemplatePreviewModal(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }} aria-label="Close">
                  <IconCross size={18} color="#94A3B8" />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 0.9fr) minmax(360px, 1.4fr)', flex: 1, overflow: 'hidden' }}>
              <div style={{ padding: 16, borderRight: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', background: 'rgba(7,13,30,0.65)' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38BDF8', textTransform: 'uppercase', marginBottom: 8 }}>
                  Template Parameters
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginBottom: 12 }}>
                  Trigger: <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{templatePreviewModal.tpl.triggerEvent}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {templatePreviewModal.tpl.variables.map((vSpec) => (
                    <div key={vSpec.key}>
                      <label style={{ display: 'block', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 600, marginBottom: 4 }}>{vSpec.label}</label>
                      <input
                        type="text"
                        className="form-input form-input-sm"
                        value={templatePreviewModal.vars[vSpec.key] ?? ''}
                        onChange={(e) =>
                          setTemplatePreviewModal((prev) =>
                            prev ? { ...prev, vars: { ...prev.vars, [vSpec.key]: e.target.value } } : null
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={templatePreviewModal.loading}
                  onClick={() => handleOpenTemplatePreview(templatePreviewModal.tpl, templatePreviewModal.vars)}
                  className="btn btn-sm btn-primary"
                  style={{ width: '100%', marginTop: 14, background: '#0284c7', fontWeight: 700 }}
                >
                  {templatePreviewModal.loading ? 'Rendering HTML...' : 'Re-Render Preview'}
                </button>
              </div>

              <div style={{ padding: 14, background: '#070d1e', overflowY: 'auto' }}>
                {templatePreviewModal.loading ? (
                  <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                    Rendering Institutional Brand Email Template...
                  </div>
                ) : (
                  <iframe
                    title="Mail Template Live Preview"
                    srcDoc={templatePreviewModal.renderedHtml}
                    style={{ width: '100%', height: 540, border: 'none', borderRadius: 10, background: '#0b1329' }}
                    sandbox="allow-same-origin"
                  />
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatedPage>
  );
}
