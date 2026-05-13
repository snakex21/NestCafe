import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useTaskStore } from '@/stores/taskStore';
import { getNestCafe } from '@/lib/nestcafe';
import { createLogger } from '@/lib/logger';
import { hasAnyReadyProvider } from '@nestcafe_ai/agent-core/common';
import { USE_CASE_KEYS, FAVORITES_PREVIEW_COUNT } from './homeConstants';
import { usePromptAttachments } from './usePromptAttachments';
import { useHomePageSettings } from './useHomePageSettings';

export { FAVORITES_PREVIEW_COUNT } from './homeConstants';

const logger = createLogger('Home');
const PERSONALIZED_CACHE_KEY = 'nestcafe:personalizedExamples';
const PERSONALIZED_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PersonalizedExample {
  key: string;
  title: string;
  description: string;
  prompt: string;
  icons: string[];
}

export function useHomePage() {
  const [prompt, setPrompt] = useState('');
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [workingDirectory, setWorkingDirectory] = useState<string | undefined>(undefined);
  const [personalizedExamples, setPersonalizedExamples] = useState<PersonalizedExample[] | null>(
    null,
  );
  const [isGeneratingPersonalizedExamples, setIsGeneratingPersonalizedExamples] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('home');

  const favorites = useTaskStore((state) => state.favorites);
  const favoritesList = Array.isArray(favorites) ? favorites : [];
  const loadFavorites = useTaskStore((state) => state.loadFavorites);
  const removeFavorite = useTaskStore((state) => state.removeFavorite);
  const startTask = useTaskStore((state) => state.startTask);
  const cancelTask = useTaskStore((state) => state.cancelTask);
  const autoApprovePermissions = useTaskStore((state) => state.autoApprovePermissions);
  const isLoading = useTaskStore((state) => state.isLoading);
  const addTaskUpdate = useTaskStore((state) => state.addTaskUpdate);
  const setPermissionRequest = useTaskStore((state) => state.setPermissionRequest);

  const nestcafe = useMemo(() => getNestCafe(), []);

  // Load personalized examples from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(PERSONALIZED_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.examples && Array.isArray(parsed.examples) && parsed.examples.length === 9) {
          const age = Date.now() - (parsed.timestamp || 0);
          if (age < PERSONALIZED_CACHE_TTL) {
            setPersonalizedExamples(parsed.examples);
          }
        }
      }
    } catch {
      setPersonalizedExamples(null);
    }
  }, []);

  const generatePersonalizedExamples = useCallback(async () => {
    if (isGeneratingPersonalizedExamples) {
      return;
    }

    setIsGeneratingPersonalizedExamples(true);
    try {
      const tasks = (await nestcafe.listTasks()) as Array<{ prompt: string; summary?: string }>;
      const recentPrompts = tasks
        .slice(0, 20)
        .map((t) => t.prompt)
        .filter(Boolean);
      if (recentPrompts.length < 3) return;

      const response = await nestcafe.aiComplete(
        'You are an assistant that analyzes user behavior. Based on these recent tasks:\n\n' +
          recentPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n') +
          '\n\nGenerate 9 personalized, varied example tasks this user would find useful. ' +
          'Return valid JSON: {"examples":[{"title":"short title","description":"one line","prompt":"the full task prompt","icons":[]}]}. ' +
          'No markdown, no code fences, ONLY the JSON object.',
      );
      if (response?.text) {
        const parsed = JSON.parse(response.text);
        if (parsed.examples?.length === 9) {
          const examples = parsed.examples.map((ex: Record<string, unknown>, i: number) => ({
            key: `personalized-${i}`,
            title: String(ex.title || ''),
            description: String(ex.description || ''),
            prompt: String(ex.prompt || ''),
            icons: Array.isArray(ex.icons) ? (ex.icons as string[]) : [],
          }));
          setPersonalizedExamples(examples);
          localStorage.setItem(
            PERSONALIZED_CACHE_KEY,
            JSON.stringify({ examples, timestamp: Date.now() }),
          );
        }
      }
    } catch (err) {
      logger.error('Failed to generate personalized examples', err);
    } finally {
      setIsGeneratingPersonalizedExamples(false);
    }
  }, [nestcafe, isGeneratingPersonalizedExamples]);

  const useCaseExamples = useMemo(
    () =>
      personalizedExamples
        ? personalizedExamples
        : USE_CASE_KEYS.map(({ key, icons }) => ({
            key,
            title: t(`useCases.${key}.title`),
            description: t(`useCases.${key}.description`),
            prompt: t(`useCases.${key}.prompt`),
            icons: icons as unknown as string[],
          })),
    [t, personalizedExamples],
  );

  useEffect(() => {
    if (location.pathname === '/' && typeof loadFavorites === 'function') {
      void loadFavorites();
    }
  }, [location.pathname, loadFavorites]);

  useEffect(() => {
    const unsubscribeTask = nestcafe.onTaskUpdate((event) => {
      addTaskUpdate(event);
    });
    const unsubscribePermission = nestcafe.onPermissionRequest((request) => {
      setPermissionRequest(request);
    });
    return () => {
      unsubscribeTask();
      unsubscribePermission();
    };
  }, [addTaskUpdate, setPermissionRequest, nestcafe]);

  const {
    attachments,
    attachmentError,
    setAttachments,
    buildPromptWithAttachments,
    handleExampleClick,
    handleSkillSelect,
    handleAttachFiles,
    addFiles,
    MAX_FILES,
  } = usePromptAttachments({ setPrompt });

  const executeTask = useCallback(async () => {
    if ((!prompt.trim() && attachments.length === 0) || isLoading) {
      return;
    }
    const taskId = `task_${Date.now()}`;
    const enrichedPrompt = buildPromptWithAttachments(prompt.trim(), attachments);
    const task = await startTask({
      prompt: enrichedPrompt,
      taskId,
      files: attachments,
      workingDirectory,
      autoApprovePermissions,
    });
    if (task) {
      setAttachments([]);
      setWorkingDirectory(undefined);
      navigate(`/execution/${task.id}`);
    }
  }, [
    prompt,
    attachments,
    workingDirectory,
    isLoading,
    startTask,
    setAttachments,
    navigate,
    buildPromptWithAttachments,
    autoApprovePermissions,
  ]);

  const {
    showSettingsDialog,
    settingsInitialTab,
    setResumeAfterSettingsSave,
    setSettingsInitialTab,
    handleSettingsDialogChange,
    handleOpenSpeechSettings,
    handleOpenModelSettings,
    handleOpenSettings,
    handleApiKeySaved,
  } = useHomePageSettings({ onResume: executeTask });

  const handleSubmit = useCallback(async () => {
    if (isLoading) {
      void cancelTask();
      return;
    }
    if (!prompt.trim() && attachments.length === 0) {
      return;
    }
    try {
      const isE2EMode = await nestcafe.isE2EMode();
      if (!isE2EMode) {
        const settings = await nestcafe.getProviderSettings();
        if (!hasAnyReadyProvider(settings)) {
          setResumeAfterSettingsSave(true);
          setSettingsInitialTab('providers');
          handleOpenSettings('providers');
          return;
        }
      }
      await executeTask();
    } catch (err) {
      logger.error('Failed to submit task:', err);
    }
  }, [
    isLoading,
    prompt,
    attachments,
    nestcafe,
    executeTask,
    cancelTask,
    setResumeAfterSettingsSave,
    setSettingsInitialTab,
    handleOpenSettings,
  ]);

  const displayedFavorites = showAllFavorites
    ? favoritesList
    : favoritesList.slice(0, FAVORITES_PREVIEW_COUNT);
  const hasMoreFavorites = favoritesList.length > FAVORITES_PREVIEW_COUNT;

  return {
    prompt,
    setPrompt,
    showAllFavorites,
    setShowAllFavorites,
    attachments,
    attachmentError,
    setAttachments,
    workingDirectory,
    setWorkingDirectory,
    showSettingsDialog,
    settingsInitialTab,
    favoritesList,
    removeFavorite,
    isLoading,
    useCaseExamples,
    personalizedExamples,
    isGeneratingPersonalizedExamples,
    generatePersonalizedExamples,
    displayedFavorites,
    hasMoreFavorites,
    handleSubmit,
    handleSettingsDialogChange,
    handleOpenSpeechSettings,
    handleOpenModelSettings,
    handleOpenSettings,
    handleApiKeySaved,
    handleExampleClick,
    handleSkillSelect,
    handleAttachFiles,
    addFiles,
    MAX_FILES,
  };
}
