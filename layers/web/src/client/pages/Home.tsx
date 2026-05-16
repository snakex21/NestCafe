import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Sparkle } from '@phosphor-icons/react';
import { TaskInputBar } from '@/components/landing/TaskInputBar';
import { springs } from '@/lib/animations';
import { PlusMenu } from '@/components/landing/PlusMenu';
import { useHomePage } from './home/useHomePage';
import { FavoritesSection } from './home/FavoritesSection';
import { ExamplesSection } from './home/ExamplesSection';

export function HomePage() {
  const { t } = useTranslation('home');
  const {
    prompt,
    setPrompt,
    showAllFavorites,
    setShowAllFavorites,
    attachments,
    attachmentError,
    setAttachments,
    workingDirectory,
    setWorkingDirectory,
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
    handleOpenSpeechSettings,
    handleOpenModelSettings,
    handleExampleClick,
    handleSkillSelect,
    handleAttachFiles,
    handleOpenSettings,
    MAX_FILES,
  } = useHomePage();

  return (
    <div className="h-full flex flex-col bg-accent relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 pb-0">
        <div className="w-full max-w-[720px] mx-auto flex flex-col items-center gap-3">
          <motion.h1
            data-testid="home-title"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.gentle}
            className="font-apparat text-[32px] tracking-[-0.015em] text-foreground w-full text-center pt-[250px]"
          >
            {t('title')}
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: 0.1 }}
            className="w-full"
          >
            <TaskInputBar
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              placeholder={t('inputPlaceholder')}
              typingPlaceholder={true}
              large={true}
              autoFocus={true}
              autoSubmitOnTranscription={false}
              onOpenSpeechSettings={handleOpenSpeechSettings}
              onOpenModelSettings={handleOpenModelSettings}
              hideModelWhenNoModel={true}
              attachments={attachments}
              attachmentError={attachmentError}
              onAttachmentsChange={setAttachments}
              toolbarLeft={
                <PlusMenu
                  onSkillSelect={handleSkillSelect}
                  onOpenSettings={handleOpenSettings}
                  onAttachFiles={handleAttachFiles}
                  onSelectFolder={setWorkingDirectory}
                  disabled={isLoading}
                  attachmentCount={attachments.length}
                  maxAttachments={MAX_FILES}
                />
              }
            />
            {workingDirectory && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <span className="truncate max-w-[400px]" title={workingDirectory}>
                  {t('selectedFolder.badge', { folder: workingDirectory })}
                </span>
                <button
                  type="button"
                  onClick={() => setWorkingDirectory(undefined)}
                  className="ml-1 hover:text-foreground transition-colors"
                  aria-label={t('selectedFolder.clearAriaLabel')}
                >
                  ✕
                </button>
              </div>
            )}
          </motion.div>

          <FavoritesSection
            favoritesList={favoritesList}
            displayedFavorites={displayedFavorites}
            hasMoreFavorites={hasMoreFavorites}
            showAllFavorites={showAllFavorites}
            onSetPrompt={setPrompt}
            onRemoveFavorite={removeFavorite}
            onShowAll={() => setShowAllFavorites(true)}
          />

          <button
            onClick={generatePersonalizedExamples}
            disabled={isGeneratingPersonalizedExamples}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border hover:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkle
              className={
                isGeneratingPersonalizedExamples ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
              }
            />
            {isGeneratingPersonalizedExamples
              ? 'Generuję przykłady AI...'
              : personalizedExamples
                ? 'Wygeneruj ponownie przykłady (AI)'
                : 'Generuj moje przykłady (AI)'}
          </button>

          <ExamplesSection useCaseExamples={useCaseExamples} onExampleClick={handleExampleClick} />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-accent to-transparent" />
    </div>
  );
}
